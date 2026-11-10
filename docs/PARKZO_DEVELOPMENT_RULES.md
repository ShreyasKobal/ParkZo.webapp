# ParkZo --- Development Rules & Team Working Agreement

Use this document together with `PARKZO_PROJECT_CONTEXT.md`. Its purpose
is consistent work across developers and ChatGPT conversations.

## 1. Working style

-   Act as a senior developer guiding a beginner-friendly, professional
    SDLC.
-   Work step by step through the agreed roadmap.
-   Keep explanations short, clear and practical.
-   Give exact instructions and complete command blocks when commands
    are needed. Do not drip-feed one command at a time.
-   Once a task is agreed, proceed without repeatedly asking "start?" or
    "continue?".
-   Do not narrate progress instead of doing useful work.
-   Ask a question only when a real decision or essential missing detail
    blocks safe progress.
-   Do not guess about code, schema, routes, or existing behavior.
    Inspect first.
-   Explain technical terms simply when needed.

## 2. Shared source of truth

-   `PARKZO_PROJECT_CONTEXT.md`: product, architecture, decisions,
    progress and roadmap.
-   `PARKZO_DEVELOPMENT_RULES.md`: workflow and collaboration rules.
-   Actual Git repository and committed Supabase migration:
    authoritative for current implementation/schema.
-   If documents conflict with code/database, report the mismatch; do
    not silently choose.
-   Clearly label Confirmed Decision, Implemented, Proposal, and
    Unverified Assumption.
-   Record approved changes and their reason/impact.

## 3. Coding workflow

**Before editing** 1. Inspect relevant files and existing patterns. 2.
Read the actual migration/schema when using Supabase. 3. Identify
affected routes, components, functions and dependencies. 4. Briefly
state the smallest implementation plan. 5. Identify
data/security/deployment risks.

**While editing** - Make the smallest clean change that completes the
task. - Reuse existing components/patterns. - Preserve unrelated
behavior and visual design. - Do not create fake data or fake
functionality. - Do not add dependencies without a clear reason. - Never
expose secrets/service-role credentials. - Never weaken RLS to make a
feature work.

**After editing, report** 1. Files changed. 2. What changed. 3.
Tables/columns/API routes used. 4. Security/RLS implications. 5.
Assumptions and unresolved issues. 6. Tests/build results. 7. Possible
regressions or existing functionality affected.

Do not commit/push until the user/team has reviewed and approved.

## 4. Definition of done

For each meaningful task: - Run relevant tests; state clearly if
unavailable. - Run `npm run build`. - Run `git diff --check`. - Inspect
the final diff and unrelated file changes. - Check for secrets, debug
code and test data. - Test the user-facing flow locally where
possible. - For DB work, verify schema, RLS, policies, triggers and
safety/rollback. - For role-sensitive features, test logged-out,
customer, owner and admin sessions.

A successful build alone does not prove correctness or security.

## 5. Git and deployment

-   `main` = production.
-   `develop` = development/preview.
-   Use `feature/*` branches for isolated work when appropriate.
-   Never force-push or delete protected branches.
-   Never push unreviewed work to production.
-   Never commit `.env.local`, secrets, service-role keys or private
    credentials.
-   `.env.local.example` must contain placeholders only.
-   Check `git status` before/after work.
-   Use concise descriptive commit messages.
-   User/team reviews before commit/push.
-   Preview and Production currently share the same Supabase project;
    treat Preview DB operations as production-sensitive.

## 6. Database safety

Mandatory: - Never delete/rename legacy tables without explicit
approval. - Never delete existing user, booking, payment or test data. -
Keep `parking_bookings` untouched until the new booking system is fully
tested and archive/migration approved. - Do not insert demo/fake records
into shared Supabase. - No destructive SQL/broad updates without impact
explanation and explicit approval. - Prefer additive and reversible
migrations. - Commit migration to Git before applying it to shared
Supabase. - Review SQL before execution. - Verify after migration with
read-only queries. - Never blindly rerun a failed migration; capture
error and diagnose. - Keep RLS enabled on sensitive tables. - Never
disable RLS or make private data public as a workaround. - Never expose
service-role credentials in browser code.

## 7. UI/product consistency

-   Preserve existing ParkZo visual identity unless task explicitly asks
    for redesign.
-   Keep navbar, footer, logo, colors, fonts, spacing, animations, hover
    effects and page structure consistent.
-   Keep original HTML/CSS/JS files as reference; do not remove them
    during Next.js work.
-   Do not apply the deferred receipt redesign during unrelated tasks.
-   Keep new features mobile-first.
-   Never show fake parking, availability, ratings, bookings or payment
    states.
-   Provide clear loading/error/empty states.
-   Do not make controls appear functional unless wired to real
    behavior.

## 8. Locked product decisions

Follow `PARKZO_PROJECT_CONTEXT.md`. Especially: - Three roles: customer,
owner, admin. - Public browsing; auth for protected actions such as
booking. - Only approved locations are public. - One owner per
location. - Admin controls actual slot creation/status. - Owner requests
capacity changes; admin reviews and resolves affected bookings. -
Permanent numbered slots; no slot types. - Customers see aggregate
availability based on real slot/booking/hold data. - Five-minute
checkout hold. - No silent reassignment after customer selects a slot. -
Booking for someone else stores driver details; logged-in user owns
booking. - Razorpay planned. - Cancellation default: \>2h before start =
100%; \<=2h = 50%; after start = 0%. - Customer/owner email and SMS are
MVP; in-app notifications later. - Soft-delete locations and preserve
historical records. - Reviews/ratings after MVP.

If implementation conflicts with these decisions, stop and explain
instead of silently changing the product.

## 9. Security expectations

-   Treat client input as untrusted.
-   Calculate price and availability in trusted server-side logic.
-   Confirm payment only after server-side Razorpay verification/webhook
    validation.
-   Keep slot holds and privileged operations server-side.
-   Validate role and ownership on every protected operation.
-   Use RLS as a database security boundary, not merely UI hiding.
-   Never trust browser-supplied roles or payment totals.
-   Do not expose customer/driver personal information publicly.
-   Log important admin actions.
-   Validate owner-document and parking-photo uploads.
-   Storage access policies must be designed before enabling uploads.

## 10. Communication

-   Be direct, calm and professional.
-   Keep replies concise and focused on the current task.
-   Use small tables/checklists only when useful.
-   Give one clear next action.
-   Avoid repeating project history unless asked.
-   Do not ask unnecessary confirmation questions.
-   Status reports must distinguish completed, in-progress and pending.
-   Say when something is unknown; do not guess.

## 11. Group ChatGPT handoff

At the beginning of a group conversation: 1. Attach/paste both Markdown
files. 2. Ask the assistant to treat them as the working baseline. 3.
Also provide current Git branch/status and recent changes, because
documents may become stale.

Suggested instruction:

> We are the ParkZo development team. Read both attached Markdown files
> completely and use them as the working baseline for product decisions,
> architecture, progress and development workflow. Do not invent or
> silently change requirements. Inspect the current repository and
> committed Supabase migration before coding. Keep answers concise,
> preserve existing UI, protect existing data, and follow the documented
> roadmap and development rules. If anything conflicts or is unclear,
> report it before making changes.

**Consistency note:** These documents make context transfer much more
consistent, but cannot guarantee identical answers across separate
ChatGPT conversations. Different model versions, chat context,
repository state and new decisions can affect results. Keep the files
updated in the repository and attach the latest versions.

## 12. Current next task

Phase 2 Step 3, Public Parking Browsing and Search, is complete and
pushed to `develop`. Its two additive read-function migrations have
been applied to shared Supabase and verified. Home, Dashboard and
`/parking` are connected to real Supabase data. Preview UI checks
confirmed the pages render and the empty state behaves as expected
with no approved parking locations containing slots.

**Next task: Phase 2 Step 4 — Parking Details.**

Before coding:
1. Inspect the actual current GitHub branch, working tree and relevant
   application files.
2. Read the committed core schema migration and both public parking
   migrations. Verify the exact tables, columns, constraints, RLS,
   policies, triggers and functions involved.
3. Inspect the current `/parking` implementation and preserve its
   working search/listing behavior and existing ParkZo design.
4. Map the requested details experience to the locked product
   requirements and actual schema. Flag conflicts or missing schema
   support before implementation.

Step 4 is limited to the parking location details experience. Planned
content includes location information, full address, 2W/4W rates,
photos, amenities, operating hours and slot availability where
supported by the approved requirements and schema. Do not invent
additional capabilities or change booking, payment, auth, owner/admin
workflows, existing SQL functions, or RLS policies without a separate
review and explicit approval.

Prepare the smallest safe implementation plan, affected files,
data/security implications and test plan for review before coding.
