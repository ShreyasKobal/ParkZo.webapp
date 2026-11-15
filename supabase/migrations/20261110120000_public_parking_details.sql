-- =============================================================================
-- ParkZo Phase 2, Step 4 — public parking details
-- =============================================================================
--
-- WHY
--   The Parking Details page (/parking/[id]) needs one public, safe way to read
--   a single approved location: its public fields, aggregate availability,
--   photo metadata, amenities and operating hours. The detail tables are
--   readable by anonymous users under RLS, but table-level SELECT also exposes
--   internal columns (owner_id, uploaded_by, storage_path, ...). The page
--   therefore reads through this function instead of from the tables.
--
-- WHAT THIS DOES
--   Adds ONE new read-only function:
--
--     public.get_public_parking_details(p_location_id uuid)  RETURNS jsonb
--
--   It returns a single JSON object for an approved, non-deleted location, or
--   NULL when the id does not exist, is NULL, or the location is not public
--   (pending / rejected / suspended / soft-deleted). "Not found" and "not
--   public" are deliberately indistinguishable.
--
--   Shape of the returned object (an explicit allowlist, nothing else):
--     location_id, name, description,
--     address_line1, address_line2, city, state, postal_code, country,
--     is_24_7, rate_2w_per_hour, rate_4w_per_hour,
--     total_slots, available_slots,
--     photos    : [ { caption, is_primary } ... ]   (ordered; no file paths)
--     amenities : [ { kind, amenity_code, custom_label } ... ]
--     hours     : [ { day_of_week, is_closed, open_time, close_time } ... ]
--                 (day_of_week 0 = Sunday ... 6 = Saturday; times 'HH24:MI';
--                  an empty list when the location is open 24/7)
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * Never returns owner_id, status, status_reason, status_changed_by/at,
--     deleted_by, uploaded_by, storage_path, photo/amenity/hour row ids,
--     latitude/longitude, capacity, booking rules, cancellation settings,
--     booking rows, hold rows, user ids or any customer/driver data.
--   * Creates no table, column, index, trigger, policy or grant on any table.
--     Creates no Storage bucket or Storage policy.
--   * Does not modify, replace or drop any existing function
--     (get_public_parking_overview, get_featured_parking, get_slot_availability,
--     create_slot_hold, release_expired_slot_holds, slot_is_free are untouched).
--   * Does not touch public.parking_bookings or any legacy data. Inserts no data.
--
-- AVAILABILITY RULES (identical to get_public_parking_overview() for its
-- default window, now .. now + 1 hour — see that migration's header)
--   total_slots      live (non-soft-deleted) slots at the location; disabled
--                    slots still count. 0 means "slots not set up yet".
--   available_slots  slots whose status is 'available' (so not 'disabled',
--                    'occupied' or 'held' — current physical-state overrides)
--                    AND for which slot_is_free() is true for now..now+1h.
--   NOTE: the availability expression is intentionally the same as in
--   get_public_parking_overview() / get_featured_parking(); keep them in step
--   if any of them changes. get_slot_availability() is NOT used because it only
--   excludes 'disabled' slots and would disagree with the overview.
--
-- SECURITY PROPERTIES (same approach as the other public read functions)
--   * SECURITY DEFINER so it can count bookings/holds that anonymous users
--     cannot read. It applies the "publicly visible" rule itself
--     (status = 'approved' AND deleted_at IS NULL — identical to the RLS policy
--     "locations: public can view approved").
--   * search_path is pinned (public, pg_temp); every object is schema-qualified.
--   * The only input is a uuid; there is no free text.
--   * STABLE: it only reads. It writes nothing.
--   * EXECUTE is revoked from PUBLIC, anon and authenticated, then granted only
--     to anon, authenticated and service_role.
--
-- ROLLBACK (this migration creates only this one function):
--     drop function if exists public.get_public_parking_details(uuid);
--
-- Safe to re-run (CREATE OR REPLACE; REVOKE/GRANT are idempotent).
-- =============================================================================

begin;

-- Pre-flight: fail loudly (and roll back) if the required objects are missing.
do $$
begin
  if to_regclass('public.parking_locations') is null
     or to_regclass('public.parking_slots') is null
     or to_regclass('public.parking_photos') is null
     or to_regclass('public.parking_amenities') is null
     or to_regclass('public.parking_hours') is null then
    raise exception 'Pre-flight failed: Phase 2 tables not found. Apply 20260928120000_phase2_core_schema.sql first.';
  end if;
  if to_regprocedure('public.slot_is_free(uuid, timestamptz, timestamptz, uuid)') is null then
    raise exception 'Pre-flight failed: public.slot_is_free(uuid, timestamptz, timestamptz, uuid) not found.';
  end if;
end $$;

create or replace function public.get_public_parking_details(
  p_location_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_loc    public.parking_locations%rowtype;
  v_start  timestamptz := now();
  v_end    timestamptz := now() + interval '1 hour';
  v_total  integer;
  v_avail  integer;
  v_photos jsonb;
  v_amen   jsonb;
  v_hours  jsonb;
begin
  if p_location_id is null then
    return null;
  end if;

  -- Same "publicly visible" rule as the RLS policy and the other public
  -- functions. Anything else is reported as "not found" (NULL).
  select l.* into v_loc
  from public.parking_locations l
  where l.id = p_location_id
    and l.status = 'approved'
    and l.deleted_at is null;

  if not found then
    return null;
  end if;

  select
    count(s.id)::integer,
    (count(s.id) filter (
      where case
              -- window includes "now": only a plain 'available' slot counts
              -- (disabled / occupied / held are physical-state overrides)
              when s.status <> 'available' then false
              else public.slot_is_free(s.id, v_start, v_end, null)
            end
    ))::integer
  into v_total, v_avail
  from public.parking_slots s
  where s.location_id = v_loc.id
    and s.deleted_at is null;

  -- Photo METADATA only. No storage_path, no ids, no uploader.
  select coalesce(
           jsonb_agg(
             jsonb_build_object('caption', p.caption, 'is_primary', p.is_primary)
             order by p.is_primary desc, p.sort_order, p.created_at, p.id
           ),
           '[]'::jsonb)
  into v_photos
  from public.parking_photos p
  where p.location_id = v_loc.id
    and p.deleted_at is null;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'kind', a.kind,
               'amenity_code', a.amenity_code,
               'custom_label', a.custom_label)
             order by (a.kind = 'custom'), a.amenity_code, lower(btrim(a.custom_label)), a.id
           ),
           '[]'::jsonb)
  into v_amen
  from public.parking_amenities a
  where a.location_id = v_loc.id
    and a.deleted_at is null;

  -- Custom hours only matter when the location is not open 24/7 (the schema
  -- says parking_hours rows are ignored for 24/7 locations).
  if v_loc.is_24_7 then
    v_hours := '[]'::jsonb;
  else
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'day_of_week', h.day_of_week,
                 'is_closed',   h.is_closed,
                 'open_time',   to_char(h.open_time,  'HH24:MI'),
                 'close_time',  to_char(h.close_time, 'HH24:MI'))
               order by h.day_of_week
             ),
             '[]'::jsonb)
    into v_hours
    from public.parking_hours h
    where h.location_id = v_loc.id;
  end if;

  return jsonb_build_object(
    'location_id',      v_loc.id,
    'name',             v_loc.name,
    'description',      v_loc.description,
    'address_line1',    v_loc.address_line1,
    'address_line2',    v_loc.address_line2,
    'city',             v_loc.city,
    'state',            v_loc.state,
    'postal_code',      v_loc.postal_code,
    'country',          v_loc.country,
    'is_24_7',          v_loc.is_24_7,
    'rate_2w_per_hour', v_loc.rate_2w_per_hour,
    'rate_4w_per_hour', v_loc.rate_4w_per_hour,
    'total_slots',      v_total,
    'available_slots',  v_avail,
    'photos',           v_photos,
    'amenities',        v_amen,
    'hours',            v_hours
  );
end $$;

comment on function public.get_public_parking_details(uuid) is
  'Public, read-only: one approved parking location with public fields, aggregate availability (now..+1h, same rule as get_public_parking_overview), photo metadata (no storage paths), amenities and operating hours. NULL if not found or not public. Returns no private booking, hold or user data. See migration 20261110120000.';

-- Function privileges. Supabase grants EXECUTE to anon/authenticated by
-- default on new functions; reset, then grant exactly what is intended.
revoke all on function public.get_public_parking_details(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_parking_details(uuid)
  to anon, authenticated, service_role;

commit;

-- =============================================================================
-- READ-ONLY VERIFICATION QUERIES (run manually AFTER the migration has been
-- approved and applied; none of these change anything).
-- =============================================================================
--
-- A. BEFORE applying, record the baseline; run again AFTER. All three values
--    must be identical (compare with your own before/after values):
--
--   select
--     (select md5(string_agg(pg_get_functiondef(p.oid), '|' order by p.proname))
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('get_public_parking_overview','get_slot_availability',
--                           'create_slot_hold','release_expired_slot_holds',
--                           'slot_is_free'))                      as existing_functions_hash,
--     (select count(*) from pg_policies where schemaname = 'public') as policy_count,
--     (select count(*) from public.parking_bookings)                 as legacy_booking_rows;
--
--   This is the same query used in Step 3, so the expected values are the
--   recorded baseline: hash c4096e5f10a6ed2f9df2c5c313cdd0b9, 44 policies and
--   18 legacy rows (before AND after).
--
-- B. The function exists, is SECURITY DEFINER (prosecdef = t), STABLE
--    (provolatile = s), has a pinned search_path and returns jsonb:
--
--   select p.proname, p.prosecdef, p.provolatile, p.proconfig,
--          pg_get_function_identity_arguments(p.oid) as args,
--          pg_get_function_result(p.oid)              as returns
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'get_public_parking_details';
--
-- C. Who may execute it (expect: anon, authenticated, service_role, plus the
--    owner "postgres"; there must be NO PUBLIC row):
--
--   select coalesce(nullif(a.grantee, 0)::regrole::text, 'PUBLIC') as grantee,
--          a.privilege_type
--   from pg_proc p
--   cross join lateral aclexplode(p.proacl) a
--   where p.proname = 'get_public_parking_details';
--
-- D. Works for an anonymous visitor (rolled back). With no approved locations
--    both calls correctly return NULL, and neither may raise an error:
--
--   begin;
--     set local role anon;
--     select public.get_public_parking_details(gen_random_uuid());
--     select public.get_public_parking_details(null);
--   rollback;
--
-- E. Once approved locations exist: the returned counts must equal that
--    location's counts in get_public_parking_overview(). This must return
--    0 rows:
--
--   select o.location_id
--   from public.get_public_parking_overview(null, null, null, 100) o
--   cross join lateral public.get_public_parking_details(o.location_id) d
--   where (d->>'total_slots')::int     <> o.total_slots
--      or (d->>'available_slots')::int <> o.available_slots;
--   -- (only meaningful while there are 100 or fewer approved locations, and
--   --  only if no booking/hold changes between the two calls)
--
-- F. The returned keys never include private fields. Run for one approved
--    location id; expect an empty "forbidden_keys" list and no storage_path
--    anywhere in the text:
--
--   select d.k as forbidden_key
--   from (select public.get_public_parking_details('<approved-location-uuid>') as j) x,
--        lateral jsonb_object_keys(x.j) as d(k)
--   where d.k in ('owner_id','status','status_reason','status_changed_by',
--                 'deleted_by','uploaded_by','storage_path','latitude','longitude','capacity');
--   select x.j::text like '%storage_path%' as leaks_storage_path
--   from (select public.get_public_parking_details('<approved-location-uuid>') as j) x;
-- =============================================================================
