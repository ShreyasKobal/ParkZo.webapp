-- =============================================================================
-- ParkZo Phase 2, Step 3 — featured parking for Home and Dashboard
-- =============================================================================
--
-- WHY
--   get_public_parking_overview() (migration 20261105120000) orders locations
--   by name and then applies LIMIT (max 100). A client that wants "the most
--   available locations" could therefore only rank the first 100 locations
--   alphabetically. This function ranks ALL approved locations in the
--   database and returns only the top N, so Home and Dashboard can show the
--   3 most available locations across the full dataset (and download 3 rows
--   instead of 100).
--
-- WHAT THIS DOES
--   Adds ONE new read-only function:
--
--     public.get_featured_parking(p_count)
--
--   It returns up to p_count approved, non-deleted locations that have at
--   least one live (non-soft-deleted) slot, ranked by:
--     1. available_slots  DESC   (most available first)
--     2. name             ASC
--     3. location id      ASC    (stable, deterministic tie-break)
--   Locations with zero actual slots are excluded.
--   The window is always "right now through the next hour".
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * Creates no table, column, index, trigger, policy or grant on any table.
--   * Does not modify, replace or drop any existing function. In particular
--     get_public_parking_overview() is left exactly as it is, and /parking
--     keeps using it. (A separate function name avoids any overload
--     ambiguity for API callers.)
--   * Does not touch public.parking_bookings or any legacy data.
--   * Inserts no data.
--
-- AVAILABILITY RULES (identical to get_public_parking_overview() for a window
-- that includes the present moment; see that migration's header)
--   total_slots      live slots at the location (disabled slots still count)
--   available_slots  slots whose status is 'available' (so not 'disabled',
--                    'occupied' or 'held' — current physical-state overrides)
--                    AND for which slot_is_free() is true for now..now+1h
--                    (no pending/confirmed booking and no active, unexpired
--                    hold overlaps).
--   NOTE: the availability expression is intentionally the same as in
--   get_public_parking_overview(); keep the two in step if either changes.
--
-- SECURITY PROPERTIES (same approach as get_public_parking_overview())
--   * SECURITY DEFINER so it can count bookings/holds that anonymous users
--     cannot read. It applies the "publicly visible" rule itself
--     (status = 'approved' AND deleted_at IS NULL — identical to the existing
--     RLS policy "locations: public can view approved").
--   * Returns ONLY public location fields, the two hourly rates and two
--     aggregate counts. Never owner_id, status_reason, who changed a status,
--     booking rows, hold rows, user ids or any customer/driver data.
--   * search_path is pinned (public, pg_temp); every object is
--     schema-qualified.
--   * p_count is clamped to 1..12 (default 3); there is no free-text input.
--   * STABLE: it only reads. It writes nothing.
--   * EXECUTE is revoked from PUBLIC, anon and authenticated, then granted
--     only to anon, authenticated and service_role.
--
-- ROLLBACK (this migration creates only this one function):
--     drop function if exists public.get_featured_parking(integer);
--
-- Safe to re-run (CREATE OR REPLACE; REVOKE/GRANT are idempotent).
-- =============================================================================

begin;

-- Pre-flight: fail loudly (and roll back) if the required objects are missing.
do $$
begin
  if to_regclass('public.parking_locations') is null
     or to_regclass('public.parking_slots') is null then
    raise exception 'Pre-flight failed: Phase 2 tables (parking_locations / parking_slots) not found. Apply 20260928120000_phase2_core_schema.sql first.';
  end if;
  if to_regprocedure('public.slot_is_free(uuid, timestamptz, timestamptz, uuid)') is null then
    raise exception 'Pre-flight failed: public.slot_is_free(uuid, timestamptz, timestamptz, uuid) not found.';
  end if;
end $$;

create or replace function public.get_featured_parking(
  p_count integer default 3     -- clamped to 1..12
)
returns table (
  location_id      uuid,
  name             text,
  description      text,
  address_line1    text,
  address_line2    text,
  city             text,
  state            text,
  postal_code      text,
  latitude         numeric,
  longitude        numeric,
  is_24_7          boolean,
  rate_2w_per_hour numeric,
  rate_4w_per_hour numeric,
  total_slots      integer,
  available_slots  integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := now();
  v_end   timestamptz := now() + interval '1 hour';
  v_count integer     := least(greatest(coalesce(p_count, 3), 1), 12);
begin
  return query
  select q.*
  from (
    select
      l.id           as location_id,
      l.name         as name,
      l.description  as description,
      l.address_line1,
      l.address_line2,
      l.city,
      l.state,
      l.postal_code,
      l.latitude,
      l.longitude,
      l.is_24_7,
      l.rate_2w_per_hour,
      l.rate_4w_per_hour,
      count(s.id)::integer as total_slots,
      (count(s.id) filter (
        where case
                -- window includes "now": only a plain 'available' slot counts
                -- (disabled / occupied / held are physical-state overrides)
                when s.status <> 'available' then false
                else public.slot_is_free(s.id, v_start, v_end, null)
              end
      ))::integer as available_slots
    from public.parking_locations l
    join public.parking_slots s            -- inner join: zero-slot locations drop out
      on s.location_id = l.id
     and s.deleted_at is null
    where l.status = 'approved'
      and l.deleted_at is null
    group by l.id
  ) q
  order by q.available_slots desc, q.name asc, q.location_id asc
  limit v_count;
end $$;

comment on function public.get_featured_parking(integer) is
  'Public, read-only: the top N approved parking locations (default 3, max 12) ranked across ALL locations by available slots now..+1h, then name, then id. Excludes locations with no slots. Returns no private booking, hold or user data. See migration 20261106120000.';

-- Function privileges. Supabase grants EXECUTE to anon/authenticated by
-- default on new functions; reset, then grant exactly what is intended.
revoke all on function public.get_featured_parking(integer)
  from public, anon, authenticated;
grant execute on function public.get_featured_parking(integer)
  to anon, authenticated, service_role;

commit;

-- =============================================================================
-- READ-ONLY VERIFICATION QUERIES (run manually AFTER the migration has been
-- approved and applied; none of these change anything).
-- =============================================================================
--
-- 1. The function exists, is SECURITY DEFINER (prosecdef = t), STABLE
--    (provolatile = s) and has a pinned search_path:
--
--   select p.proname, p.prosecdef, p.provolatile, p.proconfig,
--          pg_get_function_identity_arguments(p.oid) as args
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'get_featured_parking';
--
-- 2. Who may execute it (expect: anon, authenticated, service_role, plus the
--    owner "postgres"; there must be NO PUBLIC row):
--
--   select coalesce(nullif(a.grantee, 0)::regrole::text, 'PUBLIC') as grantee,
--          a.privilege_type
--   from pg_proc p
--   cross join lateral aclexplode(p.proacl) a
--   where p.proname = 'get_featured_parking';
--
-- 3. The exact columns it returns (must NOT include owner_id, status_reason,
--    status_changed_by, deleted_by or anything about bookings/holds/users):
--
--   select pg_get_function_result(p.oid)
--   from pg_proc p where p.proname = 'get_featured_parking';
--
-- 4. It works for an anonymous visitor (rolled back; with no approved
--    locations yet this correctly returns 0 rows):
--
--   begin;
--     set local role anon;
--     select * from public.get_featured_parking();
--     select * from public.get_featured_parking(3);
--   rollback;
--
-- 5. Existing functions are unchanged. Run this BEFORE and AFTER applying and
--    compare; all three values must be identical:
--
--   select
--     (select md5(string_agg(pg_get_functiondef(p.oid), '|' order by p.proname))
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('get_public_parking_overview','get_slot_availability',
--                           'create_slot_hold','release_expired_slot_holds',
--                           'slot_is_free'))                              as existing_functions_hash,
--     (select count(*) from pg_policies where schemaname = 'public')      as policy_count,
--     (select count(*) from public.parking_bookings)                      as legacy_booking_rows;
--
-- 6. Consistency with the overview function (once approved locations exist):
--    every row returned by get_featured_parking() must have the same
--    total_slots / available_slots as that location in
--    get_public_parking_overview(). This must return 0 rows:
--
--   select f.location_id
--   from public.get_featured_parking(12) f
--   left join public.get_public_parking_overview(null, null, null, 100) o
--          on o.location_id = f.location_id
--   where o.location_id is not null
--     and (o.total_slots <> f.total_slots or o.available_slots <> f.available_slots);
--   -- (only meaningful while there are 100 or fewer approved locations)
-- =============================================================================
