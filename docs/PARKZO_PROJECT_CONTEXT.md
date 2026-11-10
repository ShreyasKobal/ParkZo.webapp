# ParkZo --- Complete Project Context

**Purpose:** Shared handoff for the ParkZo development team and group
ChatGPT. Treat this as the project baseline. The actual Git repository
and committed Supabase migration remain authoritative for current
code/schema details.

> This document consolidates the project context available in this
> conversation. It is not a verbatim transcript of every earlier
> message, and an exact count of discovery questions is unavailable.

## 1. Product overview

ParkZo is a smart parking management platform for three roles:

-   **Customer/Driver:** browse approved parking, search, check
    availability, book, pay, manage bookings and receipts.
-   **Parking Owner:** apply to list parking, manage permitted location
    details, view bookings/earnings, request capacity changes.
-   **Admin:** review applications, approve/manage parking,
    create/manage slots, resolve capacity/booking conflicts, oversee
    payments/refunds and audit actions.

Main goals: public parking discovery; accurate live availability;
immediate and future bookings; booking for another driver; Razorpay
payments; customer/owner/admin dashboards; email/SMS notifications;
strong RLS; permanent booking/payment/slot history.

## 2. Technology and deployment

  Area               Current setup
  ------------------ ---------------------------------------------------
  Frontend           Next.js App Router, React
  Backend/database   Supabase
  Auth               Supabase email/password + Google OAuth
  Hosting            Vercel
  Source control     GitHub
  Planned payments   Razorpay
  Production         https://parkzowebapp.vercel.app/
  Repository         https://github.com/ShreyasKobal/ParkZo.webapp.git
  Supabase URL       https://wapnwkqyhvdkvbqtstwt.supabase.co

Branches: `main` is production, `develop` is development/preview, and
`feature/*` is for isolated work. Vercel production deploys from `main`;
Preview is used for `develop`. Preview and production currently share
one Supabase project because the project limit was reached. Treat all
database writes/migrations as production-sensitive. Do not force-push,
delete protected branches, or push unreviewed work to `main`.

Environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env.local` is ignored by Git. Never
commit real secrets or service-role keys. `.env.local.example` must
contain placeholders only.

## 3. Phase 1: original website and Next.js migration

The original site used plain HTML/CSS/JS and Supabase. Original pages:
`index.html`, `booking.html`, `contact.html`, `dashboard.html`,
`features.html`, `forgot-password.html`, `login.html`,
`payment-preview.html`, `payment-success.html`, `receipt.html`,
`signup.html`, plus CSS/images/JS/Supabase/GitHub files.

Migrated Next.js routes include: - `/` (`app/page.js`) - `/dashboard` -
`/login` - `/signup` - `/forgot-password` - `/booking` - `/receipt` -
`/payment-preview` - `/payment-success` - `/contact` - `/features`

Important files/components include `app/layout.js`,
`lib/supabaseClient.js`, `lib/auth/AuthProvider.js`,
`lib/auth/useAuth.js`, `components/Navbar.js`,
`app/auth/callback/page.js`, `app/features/features.css`. Public images
include `carlogo.png`, `userlogo.png`, and `parking-mall.png`,
`parking-office.png`, `parking-metro.png`.

**Preserve the original visual identity:** navbar/footer, logo, car
animations, green ring, avatar glow, CSS animations, wording, positions,
fonts, colors, spacing, hover effects and theme. Migration was not a
redesign. Keep original HTML/CSS/JS files for comparison; do not delete
them. `ai-suggestions.html` and `favorites.html` did not exist even
though old dashboard links referenced them; do not invent these routes
without approval. A receipt redesign was explicitly deferred to Phase 2.
Do not silently fix unrelated legacy bugs during migration; document and
defer them unless required.

Phase 1 migration is considered complete and audited. Home, Login,
Signup, Forgot Password, Payment Preview, Payment Success and Receipt
were locally tested and working.

## 4. Authentication and navigation foundation

Implemented: - Central `AuthProvider` and `useAuth`. - Shared navbar. -
OAuth callback that exchanges code and safely returns to `next`. -
Public `/`, `/contact`, `/features`. - `/dashboard` redirects logged-out
users to `/login?next=/dashboard`. - `/booking` redirects logged-out
users to `/login?next=/booking`. - Google OAuth callback and Preview
redirect were tested. - Navbar shows logged-in avatar dropdown or
logged-out auth entry. - Sign out in logged-in dropdown. -
Search/notifications remained nonfunctional in this step.

Avatar dropdown issue was fixed using a wrapper ref and outside-click
containment rather than `stopPropagation`; user tested and confirmed it
worked.

**Locked future auth UX:** Logged-out navbar should have one account
entry. Clicking it opens an auth modal/card on the current page with
slight backdrop blur/overlay; background scrolling disabled; Login, Sign
Up, Forgot Password views switch inside the modal; clicking outside
closes it. Preserve email/password and Google logic. Existing `/login`,
`/signup`, `/forgot-password` routes may remain for compatibility. Not
yet implemented.

## 5. Existing database and data preservation

Original `profiles` columns: `id`, `user_id`, `full_name`, `role`,
`membership`, `created_at`.

Verified current `profiles` additions: `phone` (text), `avatar_url`
(text), `updated_at` (timestamptz).

Verified legacy `parking_bookings` columns, unchanged: - `id` uuid -
`customer_name` text - `vehicle_number` text - `booking_date` date -
`start_time` time - `end_time` time - `vehicle_type` text - `location`
text - `amount_paid` numeric - `created_at` timestamptz -
`payment_status` text - `payment_time` timestamptz - `user_id` uuid

**Preservation rules:** Do not delete `profiles` or `parking_bookings`.
`profiles` is extended, not replaced. `parking_bookings` is legacy and
remains separate while the new system is built/tested. Keep all old/test
data untouched. Only consider archive/rename after the new booking
system is fully tested and team approves. No demo/fake data was inserted
in the Phase 2 migration.

## 6. Phase 2 database migration --- deployed and verified

Migration file:
`supabase/migrations/20260928120000_phase2_core_schema.sql`\
Commit: `2900c78` --- `Add Phase 2 parking database schema`\
It was committed/pushed to `develop`, then executed successfully in the
shared Supabase project. Supabase showed a potential RLS warning; user
selected **Run and enable RLS** and reported success.

15 verified new tables: 1. `parking_locations` 2. `parking_slots` 3.
`parking_layout_elements` 4. `slot_holds` 5. `bookings` 6.
`booking_drivers` 7. `payments` 8. `refunds` 9. `parking_photos` 10.
`parking_amenities` 11. `parking_hours` 12. `owner_applications` 13.
`capacity_change_requests` 14. `notifications` 15. `audit_logs`

RLS (`rowsecurity=true`) was verified on all 15. Policies were
inspected. In broad terms: - Public can view approved locations and
related public parking details under policies. - Owners can view their
own location and manage permitted location
details/photos/amenities/hours. - Admins can manage locations, slots and
layout elements. - Owners cannot directly modify slots. - Bookings are
visible to customers/owners/admins under policies. - Driver details are
visible with the associated booking. - Applicants can submit/view their
applications; admins review. - Owners can submit/view capacity requests;
admins review. - Payment/refund/notification access is constrained to
payer/recipient and admins. - Audit access is admin-restricted under
policies.

RLS enabled does not by itself prove complete security. Dedicated
role/session testing is still required.

Migration design corrections included: - One total capacity, not
separate 2W/4W capacities. - `vehicle_type` belongs on bookings, not
slots. - Cancellation defaults: \>2 hours before start = 100% refund;
\<=2 hours = 50%; after start = 0%. - Slot status is admin/server
controlled; owners cannot change it. - Numbered slots are permanent; no
renumbering. - No fake data or storage buckets. -
`parking_layout_elements` and associated policies/triggers included.

**Known item to inspect:** Earlier review noted possible semantic
inconsistency: `create_slot_hold()` creates a temporary hold, while
`release_expired_slot_holds()` also changes `parking_slots.status` from
held to available. Before implementing availability, inspect the actual
SQL and decide whether slot status represents physical/admin state or is
synchronized with holds. Avoid double-counting/stale status.

## 7. Locked product requirements

### Parking locations and owners

-   One owner per parking location.
-   New locations hidden until admin approval.
-   Status lifecycle: Pending → Approved → Suspended → Rejected.
-   Soft-delete only; preserve related bookings/payments/slots/history.
-   Full address + latitude + longitude.
-   Multiple photos.
-   24/7 or custom operating hours.
-   Fixed amenities list plus custom amenities.
-   Short description.
-   Owner documents required during application.
-   Admin must give rejection reason.
-   Owner flow: apply → details/documents → admin review →
    approve/reject/request changes → only approved parking is public.

### Capacity and slots

-   Owners propose capacity; admins create actual slots.
-   Admin can create slots manually or generate them from approved
    capacity.
-   Capacity requests include requested capacity, reason, supporting
    note/document; statuses Pending/Approved/Rejected and admin remarks.
-   Increase: admin creates new slots after approval.
-   Decrease: admin handles affected future bookings first; no automatic
    cancellation.
-   Permanent numbered slots (A1, A2, A3); never renumber; no slot
    types.
-   Slot states: Available / Held / Occupied / Disabled.
-   Admin controls slot creation/status; owners cannot disable/change
    status.
-   If admin disables a slot with a future booking, manually resolve it
    first: reassign or cancel/refund.
-   Customers see aggregate availability, e.g. `21 / 50 available`;
    backend calculates from real data.
-   Unavailable if confirmed booking overlaps requested time or active
    checkout hold exists.
-   Automatic assignment = first available slot by number for MVP.
-   Optional customer selection where location permits.
-   If selected slot becomes unavailable, show "Slot no longer
    available" and ask customer to choose again. Never silently
    reassign.
-   MVP layout is a simple schematic (roads, entry, exit, arrows, rows,
    slot numbers), not 3D.
-   List/map synchronized; only available slots selectable.

### Booking and checkout

-   Immediate and future bookings.
-   Exact start/end date/time; minimum 1 hour.
-   Maximum duration configurable per location.
-   Slot must be available for the entire requested period.
-   Booking for `Myself` or `Someone else`.
-   Someone else requires driver name, vehicle number, driver phone.
-   Logged-in customer remains booking owner; driver details attached;
    history includes the booking.
-   Receipt/notifications may include customer and driver as
    appropriate.
-   Human-readable booking ID, e.g. `PZ-2026-000123`.
-   Booking statuses: Pending / Confirmed / Cancelled / Completed /
    Expired.
-   Preserve booking history permanently.
-   5-minute slot hold at checkout.
-   Successful payment converts same hold to confirmed booking.
-   Payment failure/cancel/expiry releases hold.
-   Hold creation is service-role/server-side according to migration.
    Never expose service-role key in browser.
-   Customer-selected slot conflict requires re-selection, not
    auto-reassignment.

### Pricing, cancellation and payment

-   Default 4-wheeler ₹30/hour; 2-wheeler ₹20/hour.
-   30-minute billing blocks: 4W ₹15/30m; 2W ₹10/30m.
-   No daily maximum.
-   Admin can configure rates per location.
-   Price calculated on trusted server, not trusted from client.
-   Future booking horizon configurable per location.
-   Cancellation policy configurable per location; default \>2h = 100%
    refund, \<=2h = 50%, after start = 0%.
-   Razorpay planned; UPI, Cards, Net Banking.
-   Store Razorpay order/payment IDs, amount, status, timestamps.
-   Refund records include refund ID, amount, reason, status,
    timestamps.
-   Confirm booking only after server-side payment verification/webhook
    validation.

### Customer experience

-   Public browsing without login; auth required for protected actions
    such as booking.
-   Search by parking name/location/address and nearby distance.
-   Show name, distance, rate, availability, available/total slots.
-   Customer dashboard planned: Overview, Upcoming Bookings, Booking
    History, Cancellation/Refund, Receipts, Profile.
-   Reviews/ratings after MVP.

### Owner dashboard

Planned sections: Overview, My Parking, Bookings, Earnings, Application
Status, Notifications, Profile. Owners manage permitted
details/photos/amenities/hours; they cannot
create/renumber/disable/change slot status. Capacity changes require
admin review.

### Admin dashboard

Planned sections: Overview, Users, Owner Applications, Parking,
Bookings, Payments, Revenue, Analytics, System, Audit Logs. Admin
handles approvals, slots, capacity changes, affected bookings, parking
status, payments/refunds, audit, platform settings/monitoring.

### Notifications, audit, backups

-   MVP: customer email + SMS; owner email + SMS.
-   Booking/cancellation/receipt and owner-relevant parking/booking
    events.
-   In-app notifications later.
-   Important admin actions logged.
-   Automated DB backups and archived/deactivated records required
    operational safeguards.

### Revenue proposal

Hackathon-stage proposal only: Owner 60%, Admin 25%, Maintenance 10%,
Ads 5%. Not a final commercial/legal/accounting policy.

## 8. Current progress

**Completed**
- Phase 1 original website migration to Next.js.
- Central auth provider/hook, shared navbar, Google OAuth callback.
- Public home/contact/features and protected dashboard/booking routes.
- Avatar dropdown fix.
- Phase 2 core database schema committed/pushed and executed in shared Supabase; 15 new tables and RLS enablement verified.
- Legacy `parking_bookings` preserved and verified unchanged.
- Phase 2 Step 3: Public Parking Browsing and Search implemented and pushed to `develop`.
- Public overview migration `20261105120000_public_parking_overview.sql` applied to shared Supabase and verified.
- Featured parking migration `20261106120000_public_featured_parking.sql` applied to shared Supabase and verified.
- Public read functions `get_public_parking_overview(...)` and `get_featured_parking(p_count)` were checked for function properties, execute permissions, return structure and anonymous execution.
- Home, Dashboard and `/parking` use live Supabase data. Navbar search routes to `/parking?q=...`.
- Browsing UI includes name/area/address search, 2W and 4W hourly rates, total/available slot counts, availability labels, loading/error/empty states, and refresh on page load and browser-tab focus (no polling).
- Featured locations are ranked across the full dataset by available slot count using `get_featured_parking`; locations without slots are excluded from the featured list.
- Preview deployment was manually checked: Home, `/parking`, search URL/result behavior and Dashboard rendered. The empty state was observed as expected. This is Preview verification only, not production verification.
- Shared Supabase baseline was checked before and after the featured migration: existing-functions hash `c4096e5f10a6ed2f9df2c5c313cdd0b9`, policy count `44`, legacy booking rows `18`; values remained unchanged.
- No fake/demo parking records were inserted into shared Supabase.

**Verification details and boundaries**
- Claude reported 43/43 SQL tests on a scratch database and 58/58 browser tests against mocked RPC data. These are development-environment tests, not tests executed against shared Supabase.
- A randomized differential check on the scratch database reported zero mismatches against the overview function for the tested locations. This is not a live-data test.
- Shared Supabase verification covered migration success, function properties, execute grants, return structure, anonymous execution and baseline preservation.
- Preview UI checks used a database with no approved parking locations containing slots. Actual non-empty search results cannot yet be confirmed without approved location records.

**Pending / not implemented**
- Phase 2 Step 4: Parking Details page.
- Booking flow, slot selection and checkout holds.
- Razorpay payments/refunds.
- Customer dashboard improvements beyond the parking gallery.
- Owner application/dashboard and admin dashboard.
- Email/SMS notifications.
- Maps/current location/nearby/directions.
- Full role/RLS tests, end-to-end booking/payment tests, production verification and operational hardening.

**Known limitations / separate follow-up items**
- `/parking` currently requests up to 100 locations; pagination is not implemented.
- Dashboard still contains existing Quick Actions/activity content outside Step 3 scope; some of that content is static and must not be mistaken for live data.
- Anonymous access to internal `parking_locations` columns was previously identified as a separate security review item; Step 3 did not change table grants or RLS policies.
- Existing slot-hold/availability function semantics remain unchanged and must be inspected before booking work. In particular, the known `release_expired_slot_holds()` status-reset concern must be handled deliberately, not silently changed during unrelated work.

**Current source-control/deployment position**
- Step 3 implementation commit: `46b5fef` — `Add public parking browsing with real Supabase data`, pushed to `develop`.
- The featured migration is included in that commit and is applied to shared Supabase.
- `develop` is the preview branch. Production deployment from `main` has not been promoted or verified as part of Step 3.

## 9. Roadmap

    Order Workstream                                    Status
  ------- --------------------------------------------- -----------
        0 Phase 1 migration                             Completed
        1 Auth/navigation foundation                    Completed
        2 Phase 2 database foundation                   Completed
        3 Public parking browsing/search                Completed
        4 Parking details                               Pending
        5 Booking flow and slot hold                    Pending
        6 Razorpay payments/refunds                     Pending
        7 Customer dashboard                            Pending
        8 Owner system                                  Pending
        9 Admin system                                  Pending
       10 Email/SMS notifications                       Pending
       11 Maps/location/directions                      Pending
       12 Security, QA, backups, deployment readiness   Pending


## 10. Next task: Phase 2 Step 4 — Parking Details

Phase 2 Step 3, Public Parking Browsing and Search, is implemented,
pushed to `develop`, and its two additive read-function migrations are
applied and verified in shared Supabase. Preview UI checks confirmed
the pages render and the empty state behaves as expected with no
approved parking locations containing slots. Do not reopen Step 3 or
add unrelated fixes unless a specific regression is found.

Before coding Step 4:
1. Inspect the actual current `develop` repository and working tree.
2. Read the committed core schema migration and both public parking
   migrations; inspect the actual tables, constraints, RLS and
   functions used by the details experience.
3. Inspect the implemented `/parking` page, current data helper and
   styles. Preserve existing browsing/search behavior and visual identity.
4. Compare the proposed details UI/data requirements with the locked
   product requirements in this document. Report gaps or conflicts
   before changing anything.

Step 4 scope is the parking location details experience only. Planned
content includes location information, full address, 2W/4W pricing,
parking photos, amenities, operating hours and slot availability as
supported by the approved requirements and actual schema. Do not
invent extra features, modify booking/payment/auth, owner/admin flows,
or change existing SQL functions/policies unless a separately reviewed
and approved requirement makes that necessary. Prepare a scoped
implementation plan and risks for review before coding.

## 11. Phase 2 Step 4 — Parking Details (approved plan; implementation pending)

**Scope and implementation decisions**
- Add a public details route: `/parking/[id]`, using the location UUID.
- Use one additive, read-only RPC, `public.get_public_parking_details(p_location_id uuid)`, as the public data boundary. Do not fetch the underlying detail tables directly from the browser for this page.
- The function must return only an explicit allowlist of public location fields, aggregate slot counts, safe photo metadata, amenities and operating hours. It must not return `owner_id`, internal approval/status fields, `uploaded_by`, `storage_path`, booking/hold rows, or personal data.
- Use `SECURITY DEFINER`, a pinned `search_path`, fully qualified object references, `STABLE`, explicit revoke/grant statements and the same least-privilege execution pattern as the existing public read functions.
- Availability is the current one-hour window (now through now + 1 hour) and must match `get_public_parking_overview`: count non-soft-deleted physical slots in total capacity; available count includes only `status = 'available'` slots that pass `slot_is_free`. Disabled, held and occupied statuses are not available. Zero total slots must display “Slots not set up yet”, not “Full”. Do not use the existing `get_slot_availability()` for the details aggregate because its status filtering differs.
- `/parking` listing cards become links to `/parking/[id]`. Dashboard featured parking cards link directly to the matching details route. Keep the Home hero preview behavior unchanged; its existing “View all parking” link remains the Home entry point.
- Show an availability label only (Available/Limited/Full); never expose the internal location approval lifecycle/status.
- Show location name, full postal address including country, description, 2W/4W hourly rates, amenities, operating hours and aggregate availability.
- Custom hours use day numbering 0=Sunday through 6=Saturday. A closing time earlier than opening time is shown as an overnight window ending the next day. A missing schedule is shown as “Hours not provided”; 24/7 locations show “Open 24/7”.
- Do not show latitude/longitude or map/directions in Step 4; those remain for the Maps step.
- Do not add a booking CTA, slot-by-slot selection or booking controls; those remain Step 5.

**Photo handling decision**
- The core schema migration deliberately did not create a Storage bucket. Do not create a bucket or Storage policies as part of this details-page change.
- Do not expose or return `storage_path` or generate speculative image URLs. Use the neutral photo placeholder. Distinguish “No photos yet” when there are no photo records from “Photos unavailable” when records exist but image storage is not configured. Actual image delivery/upload requires a separately reviewed Storage bucket and access-policy design.

**Security and known issue boundary**
- The previously identified anonymous table-column exposure remains a separate open security task. Step 4 must not use direct browser reads to retrieve detail fields and must not silently alter existing table grants or RLS policies. The new RPC must return only the reviewed public allowlist. Track the existing exposure for separate remediation.

**Required pre-implementation live checks**
- The shared Supabase project must be checked read-only for detail-table policies, existing public functions, Storage buckets and counts of approved locations, live slots, photo rows, amenities and hours. Claude currently has no live Supabase access; project owner must run the supplied read-only queries and share results before implementation begins.

**Migration and release workflow**
- Any new details RPC migration is additive, reviewed in full, committed/pushed to Git before it is applied to shared Supabase, and requires separate explicit approval before application. Claude must not apply SQL to shared Supabase.
- Implementation, migration and test diffs must be reviewed before commit/push. Do not promote to `main` or production without explicit approval.

**Current status:** The Step 4 plan is approved with the decisions above. Live Supabase read-only verification is pending; no Step 4 code or migration has been written.

## 11. Risks and safeguards

1.  Shared Supabase project means Preview DB writes can affect
    production.
2.  Verify availability semantics in SQL before implementing.
3.  RLS needs role-based tests, not just enabled flags.
4.  Holds, payment verification, refunds, privileged role changes and
    admin actions must be server-side.
5.  Role changes must be admin-controlled; no self-promotion.
6.  Preserve legacy `parking_bookings`.
7.  Preserve Supabase OAuth redirect allowlists for Preview and
    Production.
8.  No storage buckets were created in the migration; uploads need
    separately designed bucket access policies.

## 12. Change control

Treat the requirements and decisions here as locked. If code/schema
conflicts with this document, report the discrepancy. If a new proposal
conflicts with a locked decision, explain the impact and get team
approval before changing it. Do not claim a task is complete until
implementation, review, tests/build and user/team verification are done.
