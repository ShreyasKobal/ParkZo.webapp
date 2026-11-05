-- =============================================================================
-- ParkZo Phase 2, Step 3 — public parking overview (browse + search)
-- =============================================================================
--
-- WHAT THIS DOES
--   Adds ONE new read-only function:
--
--     public.get_public_parking_overview(p_search, p_start_time, p_end_time, p_limit)
--
--   It returns every approved, non-deleted parking location (optionally
--   filtered by a search text) together with two numbers:
--     total_slots      real, live (non-soft-deleted) slots at the location
--                      (disabled slots still count: they are physical spaces)
--     available_slots  slots that are free for the requested time window
--   One call replaces "one get_slot_availability() call per location".
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   * Creates no table, column, index, trigger, policy or grant on any table.
--   * Does not modify, replace or drop any existing function
--     (get_slot_availability, create_slot_hold, release_expired_slot_holds,
--     slot_is_free and every other function are left exactly as they are).
--   * Does not touch public.parking_bookings or any legacy data.
--   * Inserts no data.
--
-- SLOT STATUS SEMANTICS USED HERE (approved decision)
--   THIS function treats parking_slots.status 'held' and 'occupied' as
--   CURRENT PHYSICAL-STATE OVERRIDES: they describe the slot as it is right
--   now. Admins (or trusted server code) set a slot's status; owners and
--   customers cannot. Such an override blocks availability only when the
--   requested window includes the present moment. It does NOT block a window
--   that lies entirely in the future.
--
--   Notes about EXISTING behavior (documented here, NOT changed by this file):
--     * Checkout holds are rows in slot_holds, and confirmed/pending bookings
--       are rows in bookings. create_slot_hold() does not change
--       parking_slots.status. Both are read through slot_is_free(), which also
--       ignores holds that have passed their 5 minutes, so this function is
--       correct even if no cleanup job has run.
--     * The existing release_expired_slot_holds() function CAN change a slot's
--       status from 'held' to 'available' (when the slot has no active hold).
--       This migration does not modify that function and does not depend on
--       that behavior.
--
--   A slot counts as AVAILABLE for the window [p_start_time, p_end_time) when:
--     1. its status is not 'disabled', AND
--     2. no pending/confirmed booking and no active, unexpired hold overlaps
--        the window (slot_is_free), AND
--     3. if the window includes the present moment, its status is 'available'
--        (i.e. not 'occupied' or 'held': those are current physical-state
--        overrides). For a window that lies wholly in the future, a current
--        'occupied'/'held' status does not block it.
--   Default window: right now until one hour from now.
--
-- SECURITY PROPERTIES
--   * SECURITY DEFINER so it can count bookings/holds that anonymous users
--     cannot read. It therefore applies the "publicly visible" rule itself
--     (status = 'approved' AND deleted_at IS NULL — identical to the existing
--     RLS policy "locations: public can view approved").
--   * It returns ONLY: id, name, description, address fields, coordinates,
--     is_24_7, the two hourly rates and the two counts. It never returns
--     owner_id, status_reason, who changed a status, booking rows, hold rows,
--     user ids or any customer/driver data. Counts are aggregates only.
--   * search_path is pinned (public, pg_temp) and every object is
--     schema-qualified, so it cannot be hijacked by objects in another schema.
--   * Search text is trimmed, capped at 100 characters, and its LIKE wildcards
--     (% _ \) are escaped, so users cannot craft expensive/greedy patterns.
--   * The result size is clamped to 1..100 rows; the time window must be valid.
--   * It is declared STABLE: it only reads. It writes nothing.
--   * EXECUTE is revoked from PUBLIC and granted only to anon, authenticated
--     and service_role (anonymous browsing is the purpose of the function).
--
-- ROLLBACK (this migration creates only this one function):
--     drop function if exists public.get_public_parking_overview(text, timestamptz, timestamptz, integer);
--
-- Safe to re-run (CREATE OR REPLACE; REVOKE/GRANT are idempotent).
-- =============================================================================

begin;

-- Pre-flight: fail loudly (and roll back) if the Phase 2 schema is not there,
-- instead of creating a function that cannot work.
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

create or replace function public.get_public_parking_overview(
  p_search     text        default null,
  p_start_time timestamptz default null,   -- null = now
  p_end_time   timestamptz default null,   -- null = start + 1 hour
  p_limit      integer     default 50      -- clamped to 1..100
)
returns table (
  location_id     uuid,
  name            text,
  description     text,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  latitude        numeric,
  longitude       numeric,
  is_24_7         boolean,
  rate_2w_per_hour numeric,
  rate_4w_per_hour numeric,
  total_slots     integer,
  available_slots integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_start        timestamptz := coalesce(p_start_time, now());
  v_end          timestamptz;
  v_limit        integer     := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_search       text        := nullif(btrim(left(coalesce(p_search, ''), 100)), '');
  v_pattern      text;
  v_includes_now boolean;
begin
  v_end := coalesce(p_end_time, v_start + interval '1 hour');

  if v_end <= v_start then
    raise exception 'The end of the time window must be after its start' using errcode = '22023';
  end if;

  -- Escape LIKE wildcards so the search text is always matched literally.
  if v_search is not null then
    v_pattern := '%' ||
      replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') ||
      '%';
  end if;

  -- Does the window cover the present moment? (decides whether the current
  -- physical-state overrides 'occupied' / 'held' apply — see header.)
  v_includes_now := v_start <= now() and v_end > now();

  return query
  select
    l.id,
    l.name,
    l.description,
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
    count(s.id)::integer,
    (count(s.id) filter (
      where case
              when s.status = 'disabled' then false
              when v_includes_now and s.status <> 'available' then false
              else public.slot_is_free(s.id, v_start, v_end, null)
            end
    ))::integer
  from public.parking_locations l
  left join public.parking_slots s
         on s.location_id = l.id
        and s.deleted_at is null
  where l.status = 'approved'
    and l.deleted_at is null
    and (
      v_pattern is null
      or l.name          ilike v_pattern escape '\'
      or l.address_line1 ilike v_pattern escape '\'
      or l.address_line2 ilike v_pattern escape '\'
      or l.city          ilike v_pattern escape '\'
      or l.state         ilike v_pattern escape '\'
      or l.postal_code   ilike v_pattern escape '\'
    )
  group by l.id
  order by l.name, l.id
  limit v_limit;
end $$;

comment on function public.get_public_parking_overview(text, timestamptz, timestamptz, integer) is
  'Public, read-only list of approved parking locations with total and available slot counts for a time window (default: now to +1 hour). Returns no private booking, hold or user data. See migration 20261105120000.';

-- Function privileges. Supabase grants EXECUTE to anon/authenticated by
-- default on new functions; reset, then grant exactly what is intended.
revoke all on function public.get_public_parking_overview(text, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_parking_overview(text, timestamptz, timestamptz, integer)
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
--   where n.nspname = 'public' and p.proname = 'get_public_parking_overview';
--
-- 2. Who may execute it (expect: anon, authenticated, service_role, plus the
--    owner "postgres"; there must be NO row with grantee = 0 / PUBLIC):
--
--   select coalesce(nullif(a.grantee, 0)::regrole::text, 'PUBLIC') as grantee,
--          a.privilege_type
--   from pg_proc p
--   cross join lateral aclexplode(p.proacl) a
--   where p.proname = 'get_public_parking_overview';
--
-- 3. The exact columns it returns (must NOT include owner_id, status_reason,
--    status_changed_by, deleted_by or anything about bookings/holds/users):
--
--   select pg_get_function_result(p.oid)
--   from pg_proc p where p.proname = 'get_public_parking_overview';
--
-- 4. It works for an anonymous visitor (inside a transaction that is rolled
--    back; with no approved locations yet this correctly returns 0 rows):
--
--   begin;
--     set local role anon;
--     select * from public.get_public_parking_overview();
--     select * from public.get_public_parking_overview('mall');
--   rollback;
--
-- 5. Nothing else changed. Run this BEFORE and AFTER applying and compare; all
--    three values must be identical:
--
--   select
--     (select md5(string_agg(pg_get_functiondef(p.oid), '|' order by p.proname))
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public'
--         and p.proname in ('get_slot_availability','create_slot_hold',
--                           'release_expired_slot_holds','slot_is_free'))   as existing_functions_hash,
--     (select count(*) from pg_policies where schemaname = 'public')      as policy_count,
--     (select count(*) from public.parking_bookings)                      as legacy_booking_rows;
-- =============================================================================