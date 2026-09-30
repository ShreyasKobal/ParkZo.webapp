-- =============================================================================
-- ParkZo Phase 2 — core parking marketplace schema
-- =============================================================================
--
-- WHAT THIS DOES
--   * Extends public.profiles with: phone, avatar_url, updated_at
--   * Creates 15 new tables (locations, slots, layout elements, holds, bookings, drivers,
--     payments, refunds, photos, amenities, hours, owner applications,
--     capacity change requests, notifications, audit logs)
--   * Enables RLS on all of them, with least-privilege policies + grants
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * Does not touch public.parking_bookings (structure or data) in any way.
--     The new `bookings` table is a separate table; the legacy one keeps
--     working for the current Next.js app until the booking flow is migrated.
--   * Does not delete/rename anything, and does not alter profiles' existing
--     columns, RLS or policies.
--   * Does not insert any demo/seed data.
--   * Does not create Storage buckets (photo/document columns only store
--     object paths, so buckets can be added in a later migration).
--
-- DESIGN NOTES (read these before applying)
--   1. WRITES GO THROUGH THE SERVER. Bookings, holds, payments, refunds,
--      notifications and audit logs have NO client-side INSERT/UPDATE policy.
--      They are written by trusted server code using the service_role key
--      (which bypasses RLS). Customers/owners get SELECT on their own rows only.
--   2. SOFT DELETE ONLY. DELETE is revoked from anon/authenticated on every new
--      table. Bookings/drivers/payments/refunds/audit_logs additionally have a
--      trigger that rejects DELETE for everyone (permanent history).
--   3. ROLES come from profiles.role: 'user' (customer) | 'owner' | 'admin'.
--      RLS helper functions read that column with SECURITY DEFINER so policies
--      don't recurse into profiles' own RLS.
--   4. "auth.uid() IS NULL" is treated as a trusted context (service_role,
--      SQL editor, migrations). Guard triggers only restrict API callers
--      (auth.uid() IS NOT NULL) and only where noted.
--   5. Admin-only columns on parking_locations (status, rates, capacity,
--      booking rules, address, coordinates ...) are enforced by a trigger,
--      because RLS alone cannot restrict individual columns. Owners may only
--      change: name, description, is_24_7. New columns are admin-only by default.
--   6. SLOTS HAVE NO VEHICLE TYPE. vehicle_type exists on bookings only (it
--      drives pricing). A location has ONE approved total capacity = its number
--      of physical slots; triggers keep live (non-deleted) slots <= capacity,
--      and capacity can't be lowered below the live slot count.
--   7. SLOT ASSIGNMENT. create_slot_hold() (server/service_role only):
--        * customer picked a slot -> that exact slot or the error
--          'Slot no longer available'. It NEVER substitutes another slot.
--        * no slot picked -> first free slot by slot number (A2 before A10).
--      Holds last 5 minutes. Creating a hold does not change slots.status;
--      availability for a time window comes from holds + bookings
--      (see get_slot_availability). Only admins / trusted server code can
--      create or change slots; owners can view theirs, customers read availability.
--   8. CANCELLATION POLICY, per location (admin-managed). Defaults:
--        cancelled MORE than 2 h before start -> 100% refund
--        cancelled 2 h or less before start   ->  50% refund
--        cancelled after the booking started  ->   0% refund
--      cancellation_refund_percent() applies it. Refund AMOUNTS are computed by
--      the server (booking amount x percent) and recorded in refunds.
--   9. PLACEHOLDER DEFAULTS you should still confirm (editable per location):
--      max booking duration 24h, future-booking limit 30 days.
--
-- Idempotent where practical: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY
-- IF EXISTS. Re-running is safe; changing an existing table's definition
-- later must be done in a NEW migration (never edit an applied one).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. PRE-FLIGHT: fail loudly (and roll everything back) if the environment is
--    not what we expect, instead of half-applying.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'Pre-flight failed: auth.users not found (is this a Supabase database?)';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'Pre-flight failed: public.profiles not found. Refusing to continue.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) then
    raise exception 'Pre-flight failed: public.profiles.id column not found';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    raise exception 'Pre-flight failed: public.profiles.role column not found';
  end if;
end $$;

-- Needed for the "no double booking" exclusion constraints (uuid + range).
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. EXTEND public.profiles (additive only)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone text
    check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  add column if not exists avatar_url text
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- 2. GENERIC FUNCTIONS (no dependency on the new tables)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Role helpers. SECURITY DEFINER so they can read profiles regardless of
-- profiles' own RLS (and so policies that call them never recurse).
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  )
$$;

-- Protect security-sensitive profile fields. Normal authenticated users may
-- never change their own role or identity linkage. An existing admin may manage roles; trusted
-- server/SQL-editor contexts (auth.uid() IS NULL) are also allowed.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change profile roles' using errcode = '42501';
    end if;

    if new.user_id is distinct from old.user_id then
      raise exception 'Profile identity linkage cannot be changed by the account owner'
        using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_protect_security_fields on public.profiles;
create trigger profiles_protect_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

-- Permanent history: reject DELETE outright.
create or replace function public.prevent_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Rows in % are permanent history and cannot be deleted', tg_table_name
    using errcode = '42501';
end $$;

-- Append-only: reject UPDATE and DELETE.
create or replace function public.prevent_update_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '% is append-only; rows cannot be % ', tg_table_name, lower(tg_op)
    using errcode = '42501';
end $$;

-- Booking IDs like PZ-2026-000123. One global sequence (does NOT reset each
-- year); the year is the current year in India (IST).
create sequence if not exists public.booking_code_seq;

create or replace function public.next_booking_code()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'PZ-'
      || to_char(now() at time zone 'Asia/Kolkata', 'YYYY')
      || '-'
      || lpad(nextval('public.booking_code_seq')::text, 6, '0')
$$;

-- -----------------------------------------------------------------------------
-- 3. TABLES
-- -----------------------------------------------------------------------------

-- 3.1 parking_locations ------------------------------------------------------
-- One owner per location (owner_id). Location rows are created by admins
-- (typically when approving an owner_applications row); owners then manage
-- limited fields. Statuses: pending | approved | suspended | rejected.
create table if not exists public.parking_locations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete restrict,

  name          text not null,
  description   text,

  -- Full address + coordinates
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  state         text not null,
  postal_code   text not null,
  country       text not null default 'India',
  latitude      numeric(9,6) not null,
  longitude     numeric(9,6) not null,

  -- Operating hours: true = open 24/7 (parking_hours rows ignored);
  -- false = custom hours from parking_hours.
  is_24_7       boolean not null default false,

  -- ONE approved total capacity = number of physical slots at this location.
  -- Vehicle type never decides which slot is used. Changes go through
  -- capacity_change_requests; triggers keep live slots <= capacity.
  capacity integer not null default 0,

  -- Rates per hour. Defaults = platform defaults (4W ₹30, 2W ₹20); an admin
  -- overrides per location by changing these values. Billing is in 30-minute
  -- blocks (see bookings).
  rate_2w_per_hour numeric(10,2) not null default 20.00,
  rate_4w_per_hour numeric(10,2) not null default 30.00,

  -- Configurable booking rules (admin-managed)
  max_booking_duration_minutes     integer not null default 1440,
  future_booking_limit_days        integer not null default 30,
  -- Cancellation policy (per location, admin-managed). Defaults:
  --   cancelled MORE than 120 min before start -> 100% refund
  --   cancelled 120 min or less before start   ->  50% refund
  --   cancelled after the booking has started  ->   0% refund
  cancellation_full_refund_window_minutes integer not null default 120,
  cancellation_early_refund_percent       integer not null default 100,
  cancellation_late_refund_percent        integer not null default 50,
  cancellation_after_start_refund_percent integer not null default 0,

  status            text not null default 'pending',
  status_reason     text,
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users (id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete restrict,

  constraint parking_locations_name_len check (char_length(btrim(name)) between 2 and 150),
  constraint parking_locations_description_len check (description is null or char_length(description) <= 2000),
  constraint parking_locations_address_present check (
    char_length(btrim(address_line1)) > 0 and char_length(btrim(city)) > 0 and char_length(btrim(state)) > 0
  ),
  constraint parking_locations_postal_code_format check (postal_code ~ '^[1-9][0-9]{5}$'),
  constraint parking_locations_latitude_range check (latitude between -90 and 90),
  constraint parking_locations_longitude_range check (longitude between -180 and 180),
  constraint parking_locations_capacity_nonneg check (capacity >= 0),
  constraint parking_locations_rates_positive check (rate_2w_per_hour > 0 and rate_4w_per_hour > 0),
  constraint parking_locations_max_duration check (
    max_booking_duration_minutes between 30 and 43200 and max_booking_duration_minutes % 30 = 0
  ),
  constraint parking_locations_future_limit check (future_booking_limit_days between 0 and 365),
  constraint parking_locations_cancellation_window check (cancellation_full_refund_window_minutes >= 0),
  -- Percentages are 0-100 and never increase as the start time gets closer.
  constraint parking_locations_refund_percents check (
    cancellation_early_refund_percent       between 0 and 100 and
    cancellation_late_refund_percent        between 0 and 100 and
    cancellation_after_start_refund_percent between 0 and 100 and
    cancellation_early_refund_percent >= cancellation_late_refund_percent and
    cancellation_late_refund_percent  >= cancellation_after_start_refund_percent
  ),
  constraint parking_locations_status_check check (status in ('pending', 'approved', 'suspended', 'rejected')),
  constraint parking_locations_reason_required check (
    status not in ('rejected', 'suspended') or nullif(btrim(status_reason), '') is not null
  )
);

create index if not exists parking_locations_owner_idx on public.parking_locations (owner_id);
create index if not exists parking_locations_status_idx on public.parking_locations (status) where deleted_at is null;
create index if not exists parking_locations_city_idx on public.parking_locations (city) where status = 'approved' and deleted_at is null;
-- Bounding-box searches for the public map/search (no PostGIS needed yet).
create index if not exists parking_locations_geo_idx on public.parking_locations (latitude, longitude)
  where status = 'approved' and deleted_at is null;

-- 3.2 parking_photos (multiple per location; files live in Storage later) ----
create table if not exists public.parking_photos (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.parking_locations (id) on delete restrict,
  storage_path text not null,
  caption      text,
  sort_order   integer not null default 0,
  is_primary   boolean not null default false,
  uploaded_by  uuid references auth.users (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint parking_photos_path_len check (char_length(btrim(storage_path)) between 1 and 500),
  constraint parking_photos_caption_len check (caption is null or char_length(caption) <= 200),
  constraint parking_photos_storage_path_key unique (storage_path)
);

create index if not exists parking_photos_location_idx on public.parking_photos (location_id, sort_order) where deleted_at is null;
create unique index if not exists parking_photos_one_primary_per_location
  on public.parking_photos (location_id) where is_primary and deleted_at is null;

-- 3.3 parking_amenities (fixed catalogue codes + free-text custom) -----------
create table if not exists public.parking_amenities (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.parking_locations (id) on delete restrict,
  kind         text not null,
  amenity_code text,
  custom_label text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint parking_amenities_kind_check check (kind in ('fixed', 'custom')),
  constraint parking_amenities_shape check (
    (kind = 'fixed'  and amenity_code is not null and custom_label is null) or
    (kind = 'custom' and custom_label is not null and amenity_code is null)
  ),
  -- Fixed catalogue. Adding one later = new migration that replaces this CHECK.
  constraint parking_amenities_code_check check (
    amenity_code is null or amenity_code in (
      'covered', 'cctv', 'security_guard', 'ev_charging', 'well_lit',
      'washroom', 'wheelchair_accessible', 'car_wash', 'valet', 'gated'
    )
  ),
  constraint parking_amenities_label_len check (
    custom_label is null or char_length(btrim(custom_label)) between 2 and 60
  )
);

create index if not exists parking_amenities_location_idx on public.parking_amenities (location_id) where deleted_at is null;
create unique index if not exists parking_amenities_fixed_unique
  on public.parking_amenities (location_id, amenity_code)
  where kind = 'fixed' and deleted_at is null;
create unique index if not exists parking_amenities_custom_unique
  on public.parking_amenities (location_id, lower(btrim(custom_label)))
  where kind = 'custom' and deleted_at is null;

-- 3.4 parking_hours (custom hours; ignored when parking_locations.is_24_7) ---
-- day_of_week: 0 = Sunday ... 6 = Saturday. Times are local (India) wall-clock.
-- close_time < open_time means the window runs past midnight.
create table if not exists public.parking_hours (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.parking_locations (id) on delete restrict,
  day_of_week smallint not null,
  is_closed   boolean not null default false,
  open_time   time,
  close_time  time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint parking_hours_day_range check (day_of_week between 0 and 6),
  constraint parking_hours_shape check (
    (is_closed and open_time is null and close_time is null) or
    (not is_closed and open_time is not null and close_time is not null and open_time <> close_time)
  ),
  constraint parking_hours_location_day_key unique (location_id, day_of_week)
);

-- 3.5 parking_slots ----------------------------------------------------------
-- A slot is just a numbered physical space: NO vehicle type. (Vehicle type is
-- booking information only, because pricing depends on it.)
-- slot_number is PERMANENT (A1, A2, ...): unique per location including
-- soft-deleted slots (so a number is never reused) and immutable (trigger).
-- status is the slot's current state; time-range availability is derived from
-- slot_holds + bookings. Only admins/trusted server code may change slots.
create table if not exists public.parking_slots (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.parking_locations (id) on delete restrict,
  slot_number text not null,
  status      text not null default 'available',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users (id) on delete restrict,

  constraint parking_slots_number_format check (slot_number ~ '^[A-Z]{1,3}[0-9]{1,4}$'),
  constraint parking_slots_status_check check (status in ('available', 'held', 'occupied', 'disabled')),
  constraint parking_slots_location_number_key unique (location_id, slot_number),
  -- Lets holds/bookings prove a slot really belongs to the stated location.
  constraint parking_slots_id_location_key unique (id, location_id)
);

create index if not exists parking_slots_location_status_idx on public.parking_slots (location_id, status) where deleted_at is null;

-- 3.6 parking_layout_elements ------------------------------------------------
-- Simple schematic layout metadata for the MVP map/list synchronization.
-- No demo rows are inserted. Slot elements reference permanent parking slots.
create table if not exists public.parking_layout_elements (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.parking_locations (id) on delete restrict,
  element_type  text not null,
  slot_id       uuid references public.parking_slots (id) on delete restrict,
  row_number    integer,
  column_number integer,
  label         text,
  direction     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint parking_layout_element_type_check
    check (element_type in ('slot', 'entry', 'exit', 'road', 'direction')),
  constraint parking_layout_row_check
    check (row_number is null or row_number >= 0),
  constraint parking_layout_column_check
    check (column_number is null or column_number >= 0),
  constraint parking_layout_slot_type_check
    check (
      (element_type = 'slot' and slot_id is not null)
      or
      (element_type <> 'slot' and slot_id is null)
    ),
  constraint parking_layout_id_location_key unique (id, location_id)
);

create index if not exists parking_layout_elements_location_idx
  on public.parking_layout_elements (location_id);
create index if not exists parking_layout_elements_slot_idx
  on public.parking_layout_elements (slot_id)
  where slot_id is not null;

-- Ensure a layout slot belongs to the same parking location.
create or replace function public.validate_parking_layout_slot_location()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slot_id is not null and not exists (
    select 1
    from public.parking_slots s
    where s.id = new.slot_id
      and s.location_id = new.location_id
  ) then
    raise exception 'Layout slot must belong to the same parking location'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists parking_layout_slot_location_check on public.parking_layout_elements;
create trigger parking_layout_slot_location_check
before insert or update on public.parking_layout_elements
for each row execute function public.validate_parking_layout_slot_location();

-- 3.6 owner_applications (documents required) --------------------------------
create table if not exists public.owner_applications (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references auth.users (id) on delete restrict,

  business_name text not null,
  contact_phone text not null,
  contact_email text,

  proposed_location_name text not null,
  proposed_address       text not null,
  proposed_latitude      numeric(9,6),
  proposed_longitude     numeric(9,6),
  proposed_capacity      integer not null default 0,
  message text,

  -- JSON array of {type, path, name}; paths point into a Storage bucket that
  -- a later migration will create. At least one document is mandatory.
  documents jsonb not null default '[]'::jsonb,

  status        text not null default 'pending',
  reviewed_by   uuid references auth.users (id) on delete restrict,
  reviewed_at   timestamptz,
  review_notes  text,
  -- Set when an admin approves and creates the parking_locations row.
  resulting_location_id uuid references public.parking_locations (id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint owner_applications_business_name_len check (char_length(btrim(business_name)) between 2 and 150),
  constraint owner_applications_phone_format check (contact_phone ~ '^\+?[0-9]{7,15}$'),
  constraint owner_applications_location_name_len check (char_length(btrim(proposed_location_name)) between 2 and 150),
  constraint owner_applications_address_present check (char_length(btrim(proposed_address)) > 0),
  constraint owner_applications_coords check (
    (proposed_latitude is null and proposed_longitude is null) or
    (proposed_latitude between -90 and 90 and proposed_longitude between -180 and 180)
  ),
  constraint owner_applications_capacity_nonneg check (proposed_capacity >= 0),
  constraint owner_applications_documents_required check (
    jsonb_typeof(documents) = 'array' and jsonb_array_length(documents) >= 1
  ),
  constraint owner_applications_status_check check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  constraint owner_applications_review_consistent check (
    (status in ('pending', 'withdrawn') and reviewed_by is null and reviewed_at is null) or
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint owner_applications_reject_needs_notes check (
    status <> 'rejected' or nullif(btrim(review_notes), '') is not null
  )
);

create index if not exists owner_applications_applicant_idx on public.owner_applications (applicant_id);
create index if not exists owner_applications_status_idx on public.owner_applications (status);
create index if not exists owner_applications_location_idx on public.owner_applications (resulting_location_id);
-- Stops accidental double-submits of the same pending application.
create unique index if not exists owner_applications_one_pending_per_name
  on public.owner_applications (applicant_id, lower(btrim(proposed_location_name)))
  where status = 'pending';

-- 3.7 capacity_change_requests (reason + supporting document required) -------
create table if not exists public.capacity_change_requests (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.parking_locations (id) on delete restrict,
  requested_by uuid not null references auth.users (id) on delete restrict,

  -- Snapshotted from the location by a trigger (client values are ignored).
  current_capacity   integer not null,
  requested_capacity integer not null,

  reason text not null,
  supporting_documents jsonb not null default '[]'::jsonb,

  status       text not null default 'pending',
  reviewed_by  uuid references auth.users (id) on delete restrict,
  reviewed_at  timestamptz,
  review_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capacity_requests_requested_nonneg check (requested_capacity >= 0),
  constraint capacity_requests_is_a_change check (requested_capacity <> current_capacity),
  constraint capacity_requests_reason_len check (char_length(btrim(reason)) between 10 and 2000),
  constraint capacity_requests_documents_required check (
    jsonb_typeof(supporting_documents) = 'array' and jsonb_array_length(supporting_documents) >= 1
  ),
  constraint capacity_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint capacity_requests_review_consistent check (
    (status in ('pending', 'cancelled') and reviewed_by is null and reviewed_at is null) or
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists capacity_requests_location_idx on public.capacity_change_requests (location_id);
create index if not exists capacity_requests_requested_by_idx on public.capacity_change_requests (requested_by);
create index if not exists capacity_requests_pending_idx on public.capacity_change_requests (created_at) where status = 'pending';

-- 3.8 bookings ---------------------------------------------------------------
-- Permanent history (never deleted). Prices are snapshotted at booking time so
-- later rate changes never rewrite history. Billing = 30-minute blocks:
--   billable_blocks = ceil(duration / 30 min);  amount = blocks * rate / 2.
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  booking_code text not null default public.next_booking_code(),

  booked_by    uuid not null references auth.users (id) on delete restrict,
  location_id  uuid not null,
  slot_id      uuid not null,
  vehicle_type text not null,

  start_time   timestamptz not null,
  end_time     timestamptz not null,
  -- true = customer parks themselves; false = booked for someone else
  -- (driver details live in booking_drivers).
  is_for_self  boolean not null default true,

  billable_blocks integer not null,
  rate_per_hour   numeric(10,2) not null,
  amount          numeric(10,2) not null,
  currency        text not null default 'INR',

  status       text not null default 'pending',
  confirmed_at timestamptz,
  completed_at timestamptz,
  expired_at   timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_booking_code_key unique (booking_code),
  constraint bookings_booking_code_format check (booking_code ~ '^PZ-[0-9]{4}-[0-9]{6,}$'),
  constraint bookings_slot_fk foreign key (slot_id, location_id)
    references public.parking_slots (id, location_id) on delete restrict,
  constraint bookings_vehicle_type_check check (vehicle_type in ('2_wheeler', '4_wheeler')),
  constraint bookings_time_order check (end_time > start_time),
  constraint bookings_blocks_match_duration check (
    billable_blocks = ceil(extract(epoch from (end_time - start_time)) / 1800.0)
  ),
  constraint bookings_rate_positive check (rate_per_hour > 0),
  constraint bookings_amount_nonneg check (amount >= 0),
  constraint bookings_currency_inr check (currency = 'INR'),
  constraint bookings_status_check check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'expired')),
  constraint bookings_cancelled_has_timestamp check (status <> 'cancelled' or cancelled_at is not null),
  -- No two live bookings may overlap on the same slot.
  constraint bookings_no_overlap exclude using gist (
    slot_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index if not exists bookings_booked_by_idx on public.bookings (booked_by, created_at desc);
create index if not exists bookings_location_start_idx on public.bookings (location_id, start_time);
create index if not exists bookings_slot_start_idx on public.bookings (slot_id, start_time);
create index if not exists bookings_status_idx on public.bookings (status);

-- 3.9 slot_holds (5-minute holds while the customer pays) --------------------
-- expires_at defaults to now() + 5 minutes. Expired-but-still-'active' holds
-- are cleaned up by release_expired_slot_holds() (see section 6).
create table if not exists public.slot_holds (
  id          uuid primary key default gen_random_uuid(),
  slot_id     uuid not null,
  location_id uuid not null,
  user_id     uuid not null references auth.users (id) on delete restrict,
  start_time  timestamptz not null,
  end_time    timestamptz not null,
  status      text not null default 'active',
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  booking_id  uuid references public.bookings (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint slot_holds_slot_fk foreign key (slot_id, location_id)
    references public.parking_slots (id, location_id) on delete restrict,
  constraint slot_holds_time_order check (end_time > start_time),
  constraint slot_holds_expiry_after_creation check (expires_at > created_at),
  constraint slot_holds_status_check check (status in ('active', 'converted', 'released', 'expired')),
  constraint slot_holds_converted_has_booking check (status <> 'converted' or booking_id is not null),
  -- One active hold per slot per time window.
  constraint slot_holds_no_overlap exclude using gist (
    slot_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status = 'active')
);

create index if not exists slot_holds_user_idx on public.slot_holds (user_id);
create index if not exists slot_holds_location_idx on public.slot_holds (location_id);
create index if not exists slot_holds_active_expiry_idx on public.slot_holds (expires_at) where status = 'active';
create unique index if not exists slot_holds_booking_key on public.slot_holds (booking_id) where booking_id is not null;

-- 3.10 booking_drivers (who is actually driving/parking) ---------------------
create table if not exists public.booking_drivers (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings (id) on delete restrict,
  driver_name    text not null,
  driver_phone   text not null,
  driver_email   text,
  vehicle_number text not null,
  is_primary     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint booking_drivers_name_len check (char_length(btrim(driver_name)) between 2 and 100),
  constraint booking_drivers_phone_format check (driver_phone ~ '^\+?[0-9]{7,15}$'),
  constraint booking_drivers_vehicle_number_format check (vehicle_number ~ '^[A-Z0-9][A-Z0-9 -]{3,14}$')
);

create index if not exists booking_drivers_booking_idx on public.booking_drivers (booking_id);
create unique index if not exists booking_drivers_one_primary on public.booking_drivers (booking_id) where is_primary;

-- 3.11 payments (Razorpay) ---------------------------------------------------
-- amount is in rupees (numeric); convert to paise (x100) at the Razorpay API.
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  user_id    uuid not null references auth.users (id) on delete restrict,

  provider            text not null default 'razorpay',
  razorpay_order_id   text not null,
  razorpay_payment_id text,
  razorpay_signature  text,

  amount   numeric(10,2) not null,
  currency text not null default 'INR',
  status   text not null default 'created',
  method   text,
  error_code        text,
  error_description text,
  captured_at timestamptz,
  failed_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_provider_check check (provider = 'razorpay'),
  constraint payments_order_id_key unique (razorpay_order_id),
  constraint payments_payment_id_key unique (razorpay_payment_id),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_currency_inr check (currency = 'INR'),
  constraint payments_status_check check (status in (
    'created', 'authorized', 'captured', 'failed', 'partially_refunded', 'refunded'
  )),
  constraint payments_captured_has_details check (
    status not in ('captured', 'partially_refunded', 'refunded')
    or (razorpay_payment_id is not null and captured_at is not null)
  ),
  -- Lets refunds prove they belong to the same booking as their payment.
  constraint payments_id_booking_key unique (id, booking_id)
);

create index if not exists payments_booking_idx on public.payments (booking_id);
create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);
-- A booking can only ever have one successful payment.
create unique index if not exists payments_one_successful_per_booking
  on public.payments (booking_id)
  where status in ('authorized', 'captured', 'partially_refunded', 'refunded');

-- 3.12 refunds (Razorpay) ----------------------------------------------------
create table if not exists public.refunds (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null,
  booking_id  uuid not null,
  requested_by uuid references auth.users (id) on delete restrict,

  razorpay_refund_id text,
  amount   numeric(10,2) not null,
  status   text not null default 'pending',
  reason   text,
  failure_reason text,
  processed_at   timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint refunds_payment_fk foreign key (payment_id, booking_id)
    references public.payments (id, booking_id) on delete restrict,
  constraint refunds_refund_id_key unique (razorpay_refund_id),
  constraint refunds_amount_positive check (amount > 0),
  constraint refunds_status_check check (status in ('pending', 'processed', 'failed')),
  constraint refunds_processed_has_timestamp check (status <> 'processed' or processed_at is not null)
);

create index if not exists refunds_payment_idx on public.refunds (payment_id);
create index if not exists refunds_booking_idx on public.refunds (booking_id);
create index if not exists refunds_requested_by_idx on public.refunds (requested_by);

-- 3.13 notifications (email/SMS delivery records) ----------------------------
-- recipient_* are stored separately from user_id because a booking made for
-- someone else may notify the driver's phone/email.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,

  channel    text not null,
  type       text not null,
  recipient_email text,
  recipient_phone text,
  subject    text,
  body       text not null,

  status     text not null default 'queued',
  provider_message_id text,
  error_message text,
  sent_at    timestamptz,
  metadata   jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_channel_check check (channel in ('email', 'sms')),
  constraint notifications_type_format check (type ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint notifications_status_check check (status in ('queued', 'sent', 'delivered', 'failed')),
  constraint notifications_recipient_matches_channel check (
    (channel = 'email' and recipient_email is not null) or
    (channel = 'sms'   and recipient_phone is not null)
  ),
  constraint notifications_phone_format check (recipient_phone is null or recipient_phone ~ '^\+?[0-9]{7,15}$')
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_booking_idx on public.notifications (booking_id);
create index if not exists notifications_queued_idx on public.notifications (created_at) where status = 'queued';

-- 3.14 audit_logs (append-only admin trail) ---------------------------------
-- entity_id is intentionally NOT a foreign key: audit rows must outlive and
-- never block changes to the entities they describe.
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete restrict,
  actor_role  text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  reason      text,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now(),

  constraint audit_logs_action_format check (action ~ '^[a-z][a-z0-9_.]{2,79}$'),
  constraint audit_logs_entity_type_format check (entity_type ~ '^[a-z][a-z0-9_]{2,63}$')
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- -----------------------------------------------------------------------------
-- 4. HELPER + TRIGGER FUNCTIONS THAT DEPEND ON THE NEW TABLES
-- -----------------------------------------------------------------------------

-- Ownership is permanent, so this intentionally ignores deleted_at.
create or replace function public.owns_location(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parking_locations l
    where l.id = p_location_id and l.owner_id = auth.uid()
  )
$$;

-- "Visible to the public" = approved and not soft-deleted.
create or replace function public.is_location_public(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parking_locations l
    where l.id = p_location_id and l.status = 'approved' and l.deleted_at is null
  )
$$;

-- Locations: owners may only edit name/description/is_24_7; everything else
-- (status, rates, capacity, booking rules, address, coordinates, soft delete)
-- is admin-only. Ownership can't be transferred through the API by anyone.
create or replace function public.protect_parking_location_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner_editable text[] := array['name', 'description', 'is_24_7', 'updated_at'];
begin
  if auth.uid() is not null then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Parking location ownership cannot be transferred' using errcode = '42501';
    end if;
    if not public.is_admin() then
      if (to_jsonb(new) - v_owner_editable) is distinct from (to_jsonb(old) - v_owner_editable) then
        raise exception 'Only an admin can change these parking location fields' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  if new.deleted_at is not null and old.deleted_at is null and new.deleted_by is null then
    new.deleted_by := auth.uid();
  end if;
  return new;
end $$;

-- Slots: number + location are permanent for EVERYONE. Only admins (or trusted
-- server code, where auth.uid() IS NULL) may change a slot at all: owners can
-- VIEW their slots but never modify them, and customers only read availability.
-- (RLS already gives owners/customers no UPDATE policy; this is the second lock.)
create or replace function public.protect_parking_slot_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slot_number is distinct from old.slot_number or new.location_id is distinct from old.location_id then
    raise exception 'Slot numbers and their location are permanent and cannot be changed';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins or trusted server code can change slots' using errcode = '42501';
  end if;

  if new.deleted_at is not null and old.deleted_at is null and new.deleted_by is null then
    new.deleted_by := auth.uid();
  end if;
  return new;
end $$;

-- Capacity == physical slot inventory: a location can never have more live
-- (non-soft-deleted) slots than its approved capacity. Applies to every
-- caller, including admins and server code. Disabled slots still count
-- (they are still physical spaces); soft-deleting a slot frees capacity but
-- its number is never reused.
create or replace function public.enforce_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_live     integer;
begin
  if new.deleted_at is not null then
    return new;                                    -- not a live slot
  end if;
  if tg_op = 'UPDATE' and old.deleted_at is null then
    return new;                                    -- already live; not adding one
  end if;

  -- Lock the location row so concurrent inserts can't both squeeze past the cap.
  select l.capacity into v_capacity from public.parking_locations l where l.id = new.location_id for update;
  select count(*) into v_live
  from public.parking_slots s
  where s.location_id = new.location_id and s.deleted_at is null and s.id <> new.id;

  if v_live + 1 > v_capacity then
    raise exception 'Cannot add a slot: location capacity is % and it already has % live slots',
      v_capacity, v_live using errcode = '23514';
  end if;
  return new;
end $$;

-- ...and capacity can't be lowered beneath the slots that already exist
-- (soft-delete slots first).
create or replace function public.enforce_capacity_not_below_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live integer;
begin
  if new.capacity < 0 then
    return new;  -- let the capacity_nonneg CHECK give the clear error
  end if;
  if new.capacity < old.capacity then
    select count(*) into v_live
    from public.parking_slots s
    where s.location_id = new.id and s.deleted_at is null;
    if new.capacity < v_live then
      raise exception 'Capacity % is below the % live slots at this location; soft-delete slots first',
        new.capacity, v_live using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- Capacity requests: the "current" number always comes from the location,
-- never from the client.
create or replace function public.snapshot_capacity_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select l.capacity into new.current_capacity
  from public.parking_locations l
  where l.id = new.location_id;
  if not found then
    raise exception 'Unknown parking location';
  end if;
  return new;
end $$;

-- Serialises hold creation and booking creation per location, so a hold and a
-- booking (or two holds) can't grab the same slot in the same instant.
-- Transaction-scoped: released automatically at commit/rollback.
create or replace function public.lock_location_inventory(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('parkzo:inventory:' || p_location_id::text, 0));
end $$;

-- Location must be open for booking and the window must respect the location's
-- configurable rules. Shared by hold creation and booking insertion.
create or replace function public.assert_valid_booking_window(
  p_location_id uuid,
  p_start_time  timestamptz,
  p_end_time    timestamptz
)
returns public.parking_locations
language plpgsql
security definer
set search_path = public
as $$
declare
  loc public.parking_locations%rowtype;
begin
  if p_end_time <= p_start_time then
    raise exception 'Booking end time must be after its start time';
  end if;

  select * into loc from public.parking_locations where id = p_location_id;
  if not found or loc.deleted_at is not null or loc.status <> 'approved' then
    raise exception 'This parking location is not open for booking';
  end if;

  if extract(epoch from (p_end_time - p_start_time)) / 60 > loc.max_booking_duration_minutes then
    raise exception 'Booking exceeds the maximum duration of % minutes for this location',
      loc.max_booking_duration_minutes;
  end if;
  if p_start_time > now() + make_interval(days => loc.future_booking_limit_days) then
    raise exception 'Bookings can be made at most % days ahead for this location',
      loc.future_booking_limit_days;
  end if;
  if p_start_time < now() - interval '5 minutes' then
    raise exception 'Booking start time is in the past';
  end if;
  return loc;
end $$;

-- Is this slot free for the window? Blocked by any live booking, or by another
-- user's active, unexpired hold. (p_ignore_user_id = the user's own holds don't
-- count against them, e.g. when a hold is turned into a booking.)
create or replace function public.slot_is_free(
  p_slot_id        uuid,
  p_start_time     timestamptz,
  p_end_time       timestamptz,
  p_ignore_user_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    not exists (
      select 1 from public.bookings b
      where b.slot_id = p_slot_id
        and b.status in ('pending', 'confirmed')
        and tstzrange(b.start_time, b.end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)')
    )
    and not exists (
      select 1 from public.slot_holds h
      where h.slot_id = p_slot_id
        and h.status = 'active'
        and h.expires_at > now()
        and (p_ignore_user_id is null or h.user_id <> p_ignore_user_id)
        and tstzrange(h.start_time, h.end_time, '[)') && tstzrange(p_start_time, p_end_time, '[)')
    )
$$;

-- Refund percentage for cancelling a booking at p_cancel_at, from the
-- location's own policy. Defaults: >2h before start = 100, <=2h before
-- start (up to the start instant) = 50, after start = 0.
--   select public.cancellation_refund_percent(loc_id, booking_start);
create or replace function public.cancellation_refund_percent(
  p_location_id uuid,
  p_start_time  timestamptz,
  p_cancel_at   timestamptz default now()
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  loc public.parking_locations%rowtype;
begin
  select * into loc from public.parking_locations where id = p_location_id;
  if not found then
    raise exception 'Unknown parking location';
  end if;

  if p_cancel_at > p_start_time then
    return loc.cancellation_after_start_refund_percent;
  end if;
  if p_start_time - p_cancel_at > make_interval(mins => loc.cancellation_full_refund_window_minutes) then
    return loc.cancellation_early_refund_percent;
  end if;
  return loc.cancellation_late_refund_percent;
end $$;

-- Bookings: enforce the location's configurable rules, slot availability and
-- price integrity at the database level, so even buggy server code can't create
-- an invalid, double-booked or under-priced booking. vehicle_type matters here
-- ONLY for pricing; it never restricts which slot is used.
-- A concurrent double-booking that slips past this check is stopped by the
-- bookings_no_overlap exclusion constraint (SQLSTATE 23P01) - the server should
-- treat 23P01 as 'Slot no longer available'.
create or replace function public.validate_booking_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  loc  public.parking_locations%rowtype;
  slot public.parking_slots%rowtype;
  v_rate numeric(10,2);
begin
  perform public.lock_location_inventory(new.location_id);
  loc := public.assert_valid_booking_window(new.location_id, new.start_time, new.end_time);

  select * into slot from public.parking_slots where id = new.slot_id;
  if not found or slot.deleted_at is not null or slot.status = 'disabled' then
    raise exception 'Slot no longer available';
  end if;
  if new.status in ('pending', 'confirmed')
     and not public.slot_is_free(new.slot_id, new.start_time, new.end_time, new.booked_by) then
    raise exception 'Slot no longer available';
  end if;

  v_rate := case new.vehicle_type when '2_wheeler' then loc.rate_2w_per_hour else loc.rate_4w_per_hour end;
  if new.rate_per_hour <> v_rate then
    raise exception 'Rate % does not match the location rate %', new.rate_per_hour, v_rate;
  end if;
  if new.amount <> round(new.billable_blocks * new.rate_per_hour / 2, 2) then
    raise exception 'Amount % does not match % blocks at % per hour',
      new.amount, new.billable_blocks, new.rate_per_hour;
  end if;
  return new;
end $$;

-- Bookings: once created, the commercial core is frozen and terminal statuses
-- are final (permanent history). Changes = cancel + rebook.
create or replace function public.protect_booking_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.booking_code is distinct from old.booking_code
     or new.booked_by    is distinct from old.booked_by
     or new.location_id  is distinct from old.location_id
     or new.slot_id      is distinct from old.slot_id
     or new.vehicle_type is distinct from old.vehicle_type
     or new.start_time   is distinct from old.start_time
     or new.end_time     is distinct from old.end_time
     or new.billable_blocks is distinct from old.billable_blocks
     or new.rate_per_hour   is distinct from old.rate_per_hour
     or new.amount          is distinct from old.amount
     or new.currency        is distinct from old.currency
  then
    raise exception 'Booking code, customer, slot, times and pricing cannot be changed after creation';
  end if;
  if old.status in ('cancelled', 'completed', 'expired') and new.status is distinct from old.status then
    raise exception 'A % booking is final and cannot change status', old.status;
  end if;
  return new;
end $$;

-- Driver details: normalise the plate so the format CHECK is predictable.
create or replace function public.normalize_booking_driver()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.vehicle_number := upper(regexp_replace(btrim(new.vehicle_number), '\s+', ' ', 'g'));
  new.driver_name := btrim(new.driver_name);
  return new;
end $$;

-- Refunds: total non-failed refunds can never exceed the payment amount.
-- Locks the payment row so concurrent refunds can't both slip through.
create or replace function public.enforce_refund_within_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_paid numeric(10,2);
  v_already numeric(10,2);
begin
  if new.status = 'failed' then
    return new;
  end if;
  select p.amount into v_paid from public.payments p where p.id = new.payment_id for update;
  select coalesce(sum(r.amount), 0) into v_already
  from public.refunds r
  where r.payment_id = new.payment_id and r.status <> 'failed' and r.id <> new.id;
  if v_already + new.amount > v_paid then
    raise exception 'Refunds (% already + % new) would exceed the payment amount %',
      v_already, new.amount, v_paid;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 5. TRIGGERS (drop + create so re-running is safe)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- updated_at maintenance
  foreach t in array array[
    'profiles', 'parking_locations', 'parking_photos', 'parking_amenities', 'parking_hours',
    'parking_slots', 'parking_layout_elements', 'owner_applications', 'capacity_change_requests',
    'bookings', 'slot_holds', 'booking_drivers', 'payments', 'refunds', 'notifications'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;

  -- permanent history: no deletes, ever
  foreach t in array array['bookings', 'booking_drivers', 'payments', 'refunds'] loop
    execute format('drop trigger if exists prevent_delete on public.%I', t);
    execute format(
      'create trigger prevent_delete before delete on public.%I
         for each row execute function public.prevent_delete()', t);
  end loop;
end $$;

drop trigger if exists prevent_update_delete on public.audit_logs;
create trigger prevent_update_delete before update or delete on public.audit_logs
  for each row execute function public.prevent_update_delete();

drop trigger if exists protect_columns on public.parking_locations;
create trigger protect_columns before update on public.parking_locations
  for each row execute function public.protect_parking_location_columns();

drop trigger if exists protect_columns on public.parking_slots;
create trigger protect_columns before update on public.parking_slots
  for each row execute function public.protect_parking_slot_columns();

drop trigger if exists snapshot_capacity on public.capacity_change_requests;
create trigger snapshot_capacity before insert on public.capacity_change_requests
  for each row execute function public.snapshot_capacity_request();

drop trigger if exists enforce_slot_capacity on public.parking_slots;
create trigger enforce_slot_capacity before insert or update of deleted_at on public.parking_slots
  for each row execute function public.enforce_slot_capacity();

drop trigger if exists enforce_capacity_floor on public.parking_locations;
create trigger enforce_capacity_floor before update of capacity on public.parking_locations
  for each row execute function public.enforce_capacity_not_below_slots();

drop trigger if exists validate_insert on public.bookings;
create trigger validate_insert before insert on public.bookings
  for each row execute function public.validate_booking_insert();

drop trigger if exists protect_columns on public.bookings;
create trigger protect_columns before update on public.bookings
  for each row execute function public.protect_booking_columns();

drop trigger if exists normalize_driver on public.booking_drivers;
create trigger normalize_driver before insert or update on public.booking_drivers
  for each row execute function public.normalize_booking_driver();

drop trigger if exists enforce_within_payment on public.refunds;
create trigger enforce_within_payment before insert or update of amount, status on public.refunds
  for each row execute function public.enforce_refund_within_payment();

-- -----------------------------------------------------------------------------
-- 6. CALLABLE FUNCTIONS (slot generation, hold cleanup)
-- -----------------------------------------------------------------------------

-- Admin: auto-generate numbered slots (slots have no vehicle type), continuing
-- the numbering (A1..A20, then A21..). Numbers already used - including
-- soft-deleted slots - are never reused. Refuses to exceed the location's
-- capacity. Manual creation = plain INSERT into parking_slots by an admin
-- (the same capacity rule applies).
--   select * from public.generate_parking_slots('<location uuid>', 20, 'A');
create or replace function public.generate_parking_slots(
  p_location_id uuid,
  p_count       integer,
  p_prefix      text default 'A'
)
returns setof public.parking_slots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last     integer;
  v_capacity integer;
  v_live     integer;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can generate slots' using errcode = '42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'p_count must be between 1 and 500';
  end if;
  if p_prefix is null or p_prefix !~ '^[A-Z]{1,3}$' then
    raise exception 'p_prefix must be 1-3 capital letters';
  end if;

  -- Lock the location row so two concurrent generations can't collide.
  select l.capacity into v_capacity
  from public.parking_locations l
  where l.id = p_location_id and l.deleted_at is null
  for update;
  if not found then
    raise exception 'Parking location not found';
  end if;

  select count(*) into v_live
  from public.parking_slots s
  where s.location_id = p_location_id and s.deleted_at is null;
  if v_live + p_count > v_capacity then
    raise exception 'Location capacity is % and it already has % live slots; cannot add %',
      v_capacity, v_live, p_count using errcode = '23514';
  end if;

  select coalesce(max(substring(s.slot_number from char_length(p_prefix) + 1)::integer), 0)
    into v_last
  from public.parking_slots s
  where s.location_id = p_location_id
    and s.slot_number ~ ('^' || p_prefix || '[0-9]+$');

  return query
  with ins as (
    insert into public.parking_slots (location_id, slot_number)
    select p_location_id, p_prefix || (v_last + g)::text
    from generate_series(1, p_count) g
    returning *
  )
  select * from ins order by substring(slot_number from '[0-9]+$')::integer;
end $$;

-- SERVER-ONLY (service_role): place a 5-minute hold on a slot for a customer.
--   * p_slot_id given  -> the customer chose it: use exactly that slot, or fail
--     with 'Slot no longer available'. NEVER silently substitute another slot.
--   * p_slot_id NULL   -> automatic: the first free slot by slot number
--     (A2 before A10). If none is free: 'No slots available for the selected time'.
-- Slots have no type, so any free slot can serve any vehicle type.
create or replace function public.create_slot_hold(
  p_user_id     uuid,
  p_location_id uuid,
  p_start_time  timestamptz,
  p_end_time    timestamptz,
  p_slot_id     uuid default null
)
returns public.slot_holds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
  v_hold    public.slot_holds;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  perform public.lock_location_inventory(p_location_id);
  perform public.assert_valid_booking_window(p_location_id, p_start_time, p_end_time);

  -- Holds past their 5 minutes must stop blocking the slot.
  update public.slot_holds
     set status = 'expired'
   where location_id = p_location_id and status = 'active' and expires_at <= now();

  if p_slot_id is not null then
    perform 1
    from public.parking_slots s
    where s.id = p_slot_id and s.location_id = p_location_id
      and s.deleted_at is null and s.status <> 'disabled';
    if not found or not public.slot_is_free(p_slot_id, p_start_time, p_end_time, null) then
      raise exception 'Slot no longer available';
    end if;
    v_slot_id := p_slot_id;
  else
    select s.id into v_slot_id
    from public.parking_slots s
    where s.location_id = p_location_id
      and s.deleted_at is null
      and s.status <> 'disabled'
      and public.slot_is_free(s.id, p_start_time, p_end_time, null)
    order by substring(s.slot_number from '^[A-Z]+'),
             substring(s.slot_number from '[0-9]+$')::integer
    limit 1;
    if v_slot_id is null then
      raise exception 'No slots available for the selected time';
    end if;
  end if;

  insert into public.slot_holds (slot_id, location_id, user_id, start_time, end_time)
  values (v_slot_id, p_location_id, p_user_id, p_start_time, p_end_time)
  returning * into v_hold;
  return v_hold;
end $$;

-- Read-only availability for a time window: slot numbers + a yes/no. Exposes no
-- booking, hold or customer data, and only for approved locations. This is how
-- customers "read availability" without being able to see other people's rows.
create or replace function public.get_slot_availability(
  p_location_id uuid,
  p_start_time  timestamptz,
  p_end_time    timestamptz
)
returns table (slot_id uuid, slot_number text, is_available boolean)
language sql
security definer
set search_path = public
as $$
  select s.id,
         s.slot_number,
         (s.status <> 'disabled' and public.slot_is_free(s.id, p_start_time, p_end_time, null))
  from public.parking_slots s
  where s.location_id = p_location_id
    and s.deleted_at is null
    and p_end_time > p_start_time
    and public.is_location_public(p_location_id)
  order by substring(s.slot_number from '^[A-Z]+'),
           substring(s.slot_number from '[0-9]+$')::integer
$$;

-- Maintenance: expire holds past their 5 minutes and free their slots.
-- NOT scheduled here. Call it from a scheduled server job, or enable pg_cron
-- separately, e.g.:  select cron.schedule('release-holds','* * * * *',
--   $$select public.release_expired_slot_holds()$$);
-- (Correctness never depends on it running instantly: hold-creation code
-- should call it for the slot in question before inserting a new hold.)
create or replace function public.release_expired_slot_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.slot_holds
     set status = 'expired'
   where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;

  update public.parking_slots s
     set status = 'available'
   where s.status = 'held'
     and not exists (
       select 1 from public.slot_holds h where h.slot_id = s.id and h.status = 'active'
     );
  return v_count;
end $$;

-- Function privileges. Supabase grants EXECUTE to anon/authenticated by
-- default; tighten explicitly.
revoke all on function public.protect_profile_security_fields() from public, anon, authenticated;
revoke all on function public.validate_parking_layout_slot_location() from public, anon, authenticated;
revoke all on function public.current_user_role()          from public, anon;
revoke all on function public.is_admin()                   from public, anon;
revoke all on function public.owns_location(uuid)          from public, anon;
revoke all on function public.is_location_public(uuid)     from public;
revoke all on function public.generate_parking_slots(uuid, integer, text) from public, anon;
revoke all on function public.create_slot_hold(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.slot_is_free(uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.lock_location_inventory(uuid) from public, anon, authenticated;
revoke all on function public.assert_valid_booking_window(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.get_slot_availability(uuid, timestamptz, timestamptz) from public;
revoke all on function public.cancellation_refund_percent(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.release_expired_slot_holds() from public, anon, authenticated;
revoke all on function public.next_booking_code()          from public, anon, authenticated;

grant execute on function public.current_user_role()          to authenticated, service_role;
grant execute on function public.is_admin()                   to authenticated, service_role;
grant execute on function public.owns_location(uuid)          to authenticated, service_role;
grant execute on function public.is_location_public(uuid)     to anon, authenticated, service_role;
grant execute on function public.generate_parking_slots(uuid, integer, text) to authenticated, service_role;
grant execute on function public.create_slot_hold(uuid, uuid, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.slot_is_free(uuid, timestamptz, timestamptz, uuid) to service_role;
grant execute on function public.lock_location_inventory(uuid) to service_role;
grant execute on function public.assert_valid_booking_window(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.get_slot_availability(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.cancellation_refund_percent(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.release_expired_slot_holds() to service_role;
grant execute on function public.next_booking_code()          to service_role;

revoke all on sequence public.booking_code_seq from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY + GRANTS
-- -----------------------------------------------------------------------------
-- Start from zero: no anon/authenticated privileges on any new table, RLS on.
-- (service_role keeps full access and bypasses RLS: it is the trusted server.)
do $$
declare
  t text;
begin
  foreach t in array array[
    'parking_locations', 'parking_slots', 'parking_layout_elements', 'slot_holds', 'bookings', 'booking_drivers',
    'payments', 'refunds', 'parking_photos', 'parking_amenities', 'parking_hours',
    'owner_applications', 'capacity_change_requests', 'notifications', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Then grant only what the policies below actually use. DELETE/TRUNCATE are
-- never granted (soft delete only).
grant select on
  public.parking_locations, public.parking_photos, public.parking_amenities,
  public.parking_hours, public.parking_slots, public.parking_layout_elements
  to anon, authenticated;
grant insert, update on
  public.parking_locations, public.parking_photos, public.parking_amenities,
  public.parking_hours, public.parking_slots
  to authenticated;
grant insert, update on public.parking_layout_elements to authenticated;
grant select, insert, update on public.owner_applications, public.capacity_change_requests to authenticated;
grant select on
  public.slot_holds, public.bookings, public.booking_drivers,
  public.payments, public.refunds, public.notifications
  to authenticated;
grant select, insert on public.audit_logs to authenticated;

-- 7.1 parking_locations ------------------------------------------------------
drop policy if exists "locations: public can view approved" on public.parking_locations;
create policy "locations: public can view approved"
  on public.parking_locations for select to anon, authenticated
  using (status = 'approved' and deleted_at is null);

drop policy if exists "locations: owners can view their own" on public.parking_locations;
create policy "locations: owners can view their own"
  on public.parking_locations for select to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null);

drop policy if exists "locations: admins can view all" on public.parking_locations;
create policy "locations: admins can view all"
  on public.parking_locations for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "locations: admins can create" on public.parking_locations;
create policy "locations: admins can create"
  on public.parking_locations for insert to authenticated
  with check ((select public.is_admin()));

-- Owners may update their own row; the protect_columns trigger limits which
-- columns (name, description, is_24_7) and WITH CHECK blocks soft-deleting it.
drop policy if exists "locations: owners can update their own" on public.parking_locations;
create policy "locations: owners can update their own"
  on public.parking_locations for update to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null)
  with check (owner_id = (select auth.uid()) and deleted_at is null);

drop policy if exists "locations: admins can update any" on public.parking_locations;
create policy "locations: admins can update any"
  on public.parking_locations for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 7.2 parking_photos ---------------------------------------------------------
drop policy if exists "photos: public can view for approved locations" on public.parking_photos;
create policy "photos: public can view for approved locations"
  on public.parking_photos for select to anon, authenticated
  using (deleted_at is null and public.is_location_public(location_id));

drop policy if exists "photos: owners and admins can view" on public.parking_photos;
create policy "photos: owners and admins can view"
  on public.parking_photos for select to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()));

drop policy if exists "photos: owners and admins can add" on public.parking_photos;
create policy "photos: owners and admins can add"
  on public.parking_photos for insert to authenticated
  with check (
    ((select public.owns_location(location_id)) or (select public.is_admin()))
    and uploaded_by = (select auth.uid())
  );

drop policy if exists "photos: owners and admins can update" on public.parking_photos;
create policy "photos: owners and admins can update"
  on public.parking_photos for update to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()))
  with check ((select public.owns_location(location_id)) or (select public.is_admin()));

-- 7.3 parking_amenities ------------------------------------------------------
drop policy if exists "amenities: public can view for approved locations" on public.parking_amenities;
create policy "amenities: public can view for approved locations"
  on public.parking_amenities for select to anon, authenticated
  using (deleted_at is null and public.is_location_public(location_id));

drop policy if exists "amenities: owners and admins can view" on public.parking_amenities;
create policy "amenities: owners and admins can view"
  on public.parking_amenities for select to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()));

drop policy if exists "amenities: owners and admins can add" on public.parking_amenities;
create policy "amenities: owners and admins can add"
  on public.parking_amenities for insert to authenticated
  with check ((select public.owns_location(location_id)) or (select public.is_admin()));

drop policy if exists "amenities: owners and admins can update" on public.parking_amenities;
create policy "amenities: owners and admins can update"
  on public.parking_amenities for update to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()))
  with check ((select public.owns_location(location_id)) or (select public.is_admin()));

-- 7.4 parking_hours ----------------------------------------------------------
drop policy if exists "hours: public can view for approved locations" on public.parking_hours;
create policy "hours: public can view for approved locations"
  on public.parking_hours for select to anon, authenticated
  using (public.is_location_public(location_id));

drop policy if exists "hours: owners and admins can view" on public.parking_hours;
create policy "hours: owners and admins can view"
  on public.parking_hours for select to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()));

drop policy if exists "hours: owners and admins can add" on public.parking_hours;
create policy "hours: owners and admins can add"
  on public.parking_hours for insert to authenticated
  with check ((select public.owns_location(location_id)) or (select public.is_admin()));

drop policy if exists "hours: owners and admins can update" on public.parking_hours;
create policy "hours: owners and admins can update"
  on public.parking_hours for update to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()))
  with check ((select public.owns_location(location_id)) or (select public.is_admin()));

-- 7.5 parking_slots ----------------------------------------------------------
-- Slots of approved locations are readable by everyone (needed to show
-- availability). Tighten to authenticated later if you don't want that.
drop policy if exists "slots: public can view for approved locations" on public.parking_slots;
create policy "slots: public can view for approved locations"
  on public.parking_slots for select to anon, authenticated
  using (deleted_at is null and public.is_location_public(location_id));

drop policy if exists "slots: owners and admins can view" on public.parking_slots;
create policy "slots: owners and admins can view"
  on public.parking_slots for select to authenticated
  using ((select public.owns_location(location_id)) or (select public.is_admin()));

drop policy if exists "slots: admins can create" on public.parking_slots;
create policy "slots: admins can create"
  on public.parking_slots for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "slots: admins can update any" on public.parking_slots;
create policy "slots: admins can update any"
  on public.parking_slots for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Owners can VIEW their slots (policy above) but have NO insert/update policy:
-- only admins (above) or trusted server code (service_role) change slots.
-- Customers only ever see availability.

-- 7.6 parking_layout_elements -----------------------------------------------
drop policy if exists "layout: public can view approved locations" on public.parking_layout_elements;
create policy "layout: public can view approved locations"
  on public.parking_layout_elements for select to anon, authenticated
  using (public.is_location_public(location_id));

drop policy if exists "layout: owners can view their own" on public.parking_layout_elements;
create policy "layout: owners can view their own"
  on public.parking_layout_elements for select to authenticated
  using ((select public.owns_location(location_id)));

drop policy if exists "layout: admins can view all" on public.parking_layout_elements;
create policy "layout: admins can view all"
  on public.parking_layout_elements for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "layout: admins can create" on public.parking_layout_elements;
create policy "layout: admins can create"
  on public.parking_layout_elements for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "layout: admins can update" on public.parking_layout_elements;
create policy "layout: admins can update"
  on public.parking_layout_elements for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Owners can view their layout but cannot modify it.

-- 7.7 slot_holds (read-only for clients; server creates/expires them) --------
drop policy if exists "holds: customers, owners and admins can view" on public.slot_holds;
create policy "holds: customers, owners and admins can view"
  on public.slot_holds for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.owns_location(location_id))
    or (select public.is_admin())
  );

-- 7.8 bookings (read-only for clients; server creates them) ------------------
drop policy if exists "bookings: customers, owners and admins can view" on public.bookings;
create policy "bookings: customers, owners and admins can view"
  on public.bookings for select to authenticated
  using (
    booked_by = (select auth.uid())
    or (select public.owns_location(location_id))
    or (select public.is_admin())
  );

-- 7.9 booking_drivers: visible exactly when the parent booking is visible
-- (the subquery is itself filtered by the bookings policy above).
drop policy if exists "drivers: visible with their booking" on public.booking_drivers;
create policy "drivers: visible with their booking"
  on public.booking_drivers for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));

-- 7.10 payments: only the payer and admins. Owners deliberately can NOT see
-- Razorpay identifiers or payer payment details.
drop policy if exists "payments: payer and admins can view" on public.payments;
create policy "payments: payer and admins can view"
  on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 7.11 refunds: visible exactly when the parent payment is visible.
drop policy if exists "refunds: visible with their payment" on public.refunds;
create policy "refunds: visible with their payment"
  on public.refunds for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id));

-- 7.12 owner_applications ----------------------------------------------------
drop policy if exists "owner apps: applicants and admins can view" on public.owner_applications;
create policy "owner apps: applicants and admins can view"
  on public.owner_applications for select to authenticated
  using (applicant_id = (select auth.uid()) or (select public.is_admin()));

-- Any signed-in user may apply, but only as themselves and only as 'pending'.
drop policy if exists "owner apps: users can apply for themselves" on public.owner_applications;
create policy "owner apps: users can apply for themselves"
  on public.owner_applications for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null and reviewed_at is null and review_notes is null
    and resulting_location_id is null
  );

drop policy if exists "owner apps: admins can review" on public.owner_applications;
create policy "owner apps: admins can review"
  on public.owner_applications for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 7.13 capacity_change_requests ----------------------------------------------
drop policy if exists "capacity requests: owners and admins can view" on public.capacity_change_requests;
create policy "capacity requests: owners and admins can view"
  on public.capacity_change_requests for select to authenticated
  using (
    requested_by = (select auth.uid())
    or (select public.owns_location(location_id))
    or (select public.is_admin())
  );

drop policy if exists "capacity requests: owners can request for their own location" on public.capacity_change_requests;
create policy "capacity requests: owners can request for their own location"
  on public.capacity_change_requests for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and (select public.owns_location(location_id))
    and status = 'pending'
    and reviewed_by is null and reviewed_at is null and review_notes is null
  );

drop policy if exists "capacity requests: admins can review" on public.capacity_change_requests;
create policy "capacity requests: admins can review"
  on public.capacity_change_requests for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 7.14 notifications (delivery records; read-only for the recipient) ----------
drop policy if exists "notifications: recipient and admins can view" on public.notifications;
create policy "notifications: recipient and admins can view"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 7.15 audit_logs: admins only. Immutability enforced by trigger as well.
drop policy if exists "audit: admins can view" on public.audit_logs;
create policy "audit: admins can view"
  on public.audit_logs for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "audit: admins can write their own entries" on public.audit_logs;
create policy "audit: admins can write their own entries"
  on public.audit_logs for insert to authenticated
  with check ((select public.is_admin()) and actor_id = (select auth.uid()));

commit;
