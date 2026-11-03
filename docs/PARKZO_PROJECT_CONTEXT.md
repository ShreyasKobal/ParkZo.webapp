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

**Completed** - Phase 1 original website migration to Next.js. - Central
auth provider/hook, shared navbar, Google OAuth callback. - Public
home/contact/features and protected dashboard/booking routes. - Avatar
dropdown fix. - Phase 2 database schema committed/pushed and executed. -
15 new tables verified. - RLS enabled on all 15 and policies
inspected. - `profiles` additions verified. - Legacy `parking_bookings`
verified unchanged. - No fake/demo data inserted.

**Not implemented yet** - Real public parking browsing/search connected
to Supabase. - Parking details page. - Live availability/slot selection
in customer UI. - New booking flow and booking table integration. -
Server-side slot holds and payment confirmation. - Razorpay. - Customer
dashboard improvements. - Owner application/dashboard. - Admin
dashboard. - Email/SMS notifications. - Maps/current
location/nearby/directions. - Full role/RLS tests, end-to-end QA and
production hardening.

Last known relevant commits: `95cb5e0` avatar dropdown fix; `2900c78`
Phase 2 schema. Last known local status had only `?? .env.local.example`
untracked; re-check current status before work.

## 9. Roadmap

    Order Workstream                                    Status
  ------- --------------------------------------------- -----------
        0 Phase 1 migration                             Completed
        1 Auth/navigation foundation                    Completed
        2 Phase 2 database foundation                   Completed
        3 Public parking browsing/search                **Next**
        4 Parking details                               Pending
        5 Booking flow and slot hold                    Pending
        6 Razorpay payments/refunds                     Pending
        7 Customer dashboard                            Pending
        8 Owner system                                  Pending
        9 Admin system                                  Pending
       10 Email/SMS notifications                       Pending
       11 Maps/location/directions                      Pending
       12 Security, QA, backups, deployment readiness   Pending

## 10. Immediate next task: public parking browsing/search

First inspect: 1. Existing Next.js pages/components and current parking
cards/search. 2. Actual migration
`supabase/migrations/20260928120000_phase2_core_schema.sql`. 3. Exact
columns, relationships, RLS, triggers and functions. 4. Slot-hold and
availability semantics, including the known status/hold concern.

Then implement the smallest safe change: - Public approved parking list
from Supabase. - Search by name/location/address. - Real name,
description, address, price, capacity, available count,
Available/Limited/Full state. - Availability from actual
slot/booking/active-hold data; exclude disabled, occupied and held. -
Loading/error/empty states. - No fake data. - Preserve design. - Do not
change auth, booking, payment, maps, owner/admin flows in this task. -
Build and review before commit.

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
