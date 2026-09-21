# AI Workflow Rules — ParkZo

## Approach

ParkZo is built incrementally using a **spec-driven, teaching-oriented workflow**. Context files (`project-overview.md`, `architecture.md`, `code-standards.md`, `ui-context.md`) define what to build, how to build it, and what conventions to follow. The AI assistant (Claude) always implements against these specs — it does not invent product behavior or architecture decisions not defined in the context files.

**This project has a dual goal:**
1. Build a working, professional-grade parking marketplace app
2. Teach the developer (a 4th-year engineering student) the concepts, reasoning, and best practices behind each decision — for real understanding and interview readiness

Every development session should balance **building** and **learning**. Code is not just written — it's explained.

---

## Scoping Rules

- **Work on one feature unit at a time.** Example: "Implement login page UI" is one unit. "Implement login page UI AND connect to Supabase AND add validation" is three units — split it.
- **Prefer small, verifiable increments** over large speculative changes. A unit should be completable and testable within one focused session.
- **Do not combine unrelated system boundaries** in a single implementation step (e.g., don't mix frontend UI changes with database schema changes in one step).

---

## When to Split Work

Split an implementation step if it combines:

- **UI changes and backend/API changes** — build UI with mock data first, then wire up the real API as a separate step
- **Multiple unrelated API routes** — e.g., don't build `/api/bookings` and `/api/payments` in the same step
- **Behavior not clearly defined in context files** — if `project-overview.md` doesn't specify how cancellations work, that ambiguity must be resolved first (see below)
- **Database schema changes + application logic** — migrations should be a separate, reviewable step from the code that uses the new schema

**Rule of thumb:** If a change cannot be verified end-to-end within a single session, the scope is too broad — split it.

---

## Handling Missing Requirements

- **Never invent product behavior** not defined in `project-overview.md` or explicitly requested by the developer.
- **If a requirement is ambiguous**, pause and ask the developer to clarify — resolve it in the relevant context file before implementing.
- **If a requirement is missing entirely**, add it as an **Open Question** in `progress-tracker.md` before continuing, and ask the developer directly.
- **Example:** If building the cancellation flow and refund policy isn't defined anywhere, stop and ask: "What's the refund policy — full refund, partial, or no refund after booking?"

---

## Teaching & Learning Protocol

Since this project is also a learning vehicle, every development session should include:

1. **Before building:** Briefly explain *what* we're about to build and *why* this approach (e.g., "We're using Server Components here because this page doesn't need client interactivity — it just displays data").
2. **During building:** Call out key concepts as they appear (e.g., "This is Row Level Security — it means even if someone gets the API key, Postgres itself blocks them from reading other users' data").
3. **After building:** Summarize what was implemented and flag any concepts worth remembering for interviews (e.g., "This is a common interview topic: optimistic UI updates vs waiting for server confirmation").
4. **On request:** If the developer asks "why did we do it this way?" or "what's the alternative?", give a real comparison — don't just justify the choice made.

**Concepts to explicitly teach as they come up** (non-exhaustive):
- Authentication & JWT tokens
- Row Level Security (RLS) in Postgres
- Server vs Client Components in Next.js
- REST API design principles
- Database normalization and relationships
- State management patterns
- Responsive design / mobile-first CSS
- Git branching and commit hygiene
- Environment variables and secrets management
- CI/CD basics (GitHub → Vercel)

---

## Protected Files

Do not modify the following unless explicitly instructed by the developer:

- `components/ui/*` — shadcn/ui generated components (use the CLI to add/update, don't hand-edit)
- `lib/supabase.ts` — core Supabase client configuration
- Applied database migration files — create new migrations instead of editing old ones
- `.env.local` / environment secrets — never print, log, or commit these

---

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- **New table, column, or relationship** → update `architecture.md` (Storage Model section)
- **New coding convention or pattern adopted** → update `code-standards.md`
- **New feature added or scope changed** → update `project-overview.md`
- **New color, component pattern, or design decision** → update `ui-context.md`
- **Any completed work, blocker, or decision** → update `progress-tracker.md` immediately

**Docs are not an afterthought** — they're updated in the same session as the code change, not "later."

---

## Before Moving to the Next Unit

Checklist before considering a unit "done":

1. ✅ The current unit works end-to-end within its defined scope (test it in the browser/via API call)
2. ✅ No invariant defined in `architecture.md` was violated (e.g., auth checks, ownership rules)
3. ✅ `progress-tracker.md` reflects the completed work (moved from "In Progress" to "Completed")
4. ✅ `npm run build` passes with no TypeScript errors
5. ✅ Key concepts from this unit were explained to the developer
6. ✅ Code follows `code-standards.md` conventions

---

## Communication Style During Development

- **Be direct about trade-offs.** If there's a simpler way vs a "more correct" way, present both and let the developer decide when it matters for learning.
- **Flag technical debt honestly.** If we're taking a shortcut for MVP speed, say so and note it in `progress-tracker.md` under Open Questions.
- **Ask before assuming scope.** If a request could mean a small fix or a large refactor, ask which is wanted.
- **No silent scope creep.** Don't add "bonus" features not requested — suggest them, but wait for approval.

---

## Session Structure (Recommended Flow)

1. **Check `progress-tracker.md`** — what's the current goal? What was done last session?
2. **Confirm the unit of work** for this session with the developer
3. **Explain the plan** briefly before coding
4. **Implement** following code-standards.md
5. **Test/verify** the feature works end-to-end
6. **Update `progress-tracker.md`** with what was completed
7. **Recap key learnings** from the session

---

**Last Updated:** 2025-02-16
