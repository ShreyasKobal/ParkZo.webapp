# Code Standards — ParkZo

## General Principles

- **Keep modules small and single-purpose.** A component/function should do one thing well. If a file exceeds ~200 lines, consider splitting it.
- **Fix root causes, do not layer workarounds.** If a bug exists, understand why before patching. Avoid `// TODO: fix this properly later` unless tracked in `progress-tracker.md`.
- **Do not mix unrelated concerns.** A booking component should not also handle payment logic — separate them.
- **Consistency over cleverness.** Prefer readable, boring code over clever one-liners. Future team members (and interviewers) need to understand it.
- **Every feature should be testable end-to-end** before moving to the next.

---

## TypeScript

- **Strict mode required.** `"strict": true` in `tsconfig.json` — no exceptions.
- **Avoid `any`.** Use explicit interfaces/types. If truly unknown, use `unknown` and narrow it.
- **Validate external input at boundaries.** Any data from Supabase, external APIs, or user forms must be validated (use Zod) before being trusted.
- **Type all function parameters and return values** explicitly — don't rely on inference for public functions.
- **Use interfaces for objects, types for unions/primitives:**
  ```typescript
  interface Booking {
    id: string;
    userId: string;
    status: BookingStatus;
  }
  
  type BookingStatus = 'pending' | 'completed' | 'cancelled';
  ```

---

## Next.js Conventions

- **Default to Server Components.** Only add `"use client"` when you need browser interactivity (useState, onClick, useEffect, etc.)
- **Keep API routes focused.** Each route handler (`app/api/.../route.ts`) should do ONE thing — don't combine booking creation + payment processing in one route.
- **Use Server Actions for form submissions** where possible instead of client-side fetch + API route (simpler, more secure).
- **File naming:**
  - Pages: `page.tsx`
  - Layouts: `layout.tsx`
  - API routes: `route.ts`
  - Loading states: `loading.tsx`
  - Error boundaries: `error.tsx`
- **Fetch data in Server Components** whenever possible — avoid client-side `useEffect` + fetch for initial page data.

---

## React Component Standards

- **Functional components only** — no class components.
- **Props interfaces are mandatory:**
  ```typescript
  interface BookingCardProps {
    booking: Booking;
    onCancel: (id: string) => void;
  }
  
  export function BookingCard({ booking, onCancel }: BookingCardProps) {
    // ...
  }
  ```
- **One component per file.** File name matches component name (e.g., `BookingCard.tsx` exports `BookingCard`).
- **Extract repeated JSX into components** — if you copy-paste JSX twice, make it a component.
- **Custom hooks for shared logic** — if 2+ components need the same stateful logic, extract to `hooks/`.

---

## Styling (Tailwind CSS)

- **Use CSS custom property tokens** defined in `ui-context.md` — no hardcoded hex values like `bg-[#1a1a2e]`.
- **Follow the color/spacing scale** defined in `tailwind.config.ts` — don't invent new spacing values.
- **Mobile-first responsive design** — write base styles for mobile, add `md:`, `lg:` prefixes for larger screens.
- **Avoid inline styles** — use Tailwind classes; if truly dynamic, use CSS variables.
- **Use `cn()` utility** (clsx + tailwind-merge) for conditional classes:
  ```typescript
  <div className={cn("base-class", isActive && "active-class")} />
  ```

---

## API Routes

- **Validate and parse input first** — reject malformed requests before any logic runs:
  ```typescript
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  ```
- **Enforce auth and ownership before mutations** — check JWT and verify the user owns the resource being modified.
- **Return consistent response shapes:**
  ```typescript
  // Success
  { success: true, data: {...} }
  
  // Error
  { success: false, error: "Human readable message" }
  ```
- **Use proper HTTP status codes** — 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 500 (Server Error).

---

## Data and Storage

- **Metadata belongs in the database** — user info, booking details, pricing, etc. go in Supabase tables.
- **Large files belong in Supabase Storage** — parking space photos, user avatars go in storage buckets, NOT as base64 in the database.
- **Never store sensitive data in plaintext** — passwords are handled by Supabase Auth (already hashed). Don't add custom password fields.
- **Use database transactions for multi-step writes** — e.g., creating a booking + updating slot availability must be atomic.

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `BookingCard.tsx` |
| Functions/variables | camelCase | `getUserBookings()` |
| Constants | UPPER_SNAKE_CASE | `MAX_BOOKING_DURATION` |
| Files (non-component) | kebab-case | `api-client.ts` |
| Database tables | snake_case | `parking_bookings` |
| Database columns | snake_case | `user_id`, `created_at` |
| CSS classes (custom) | kebab-case | `.booking-card` |
| Environment variables | UPPER_SNAKE_CASE | `NEXT_PUBLIC_SUPABASE_URL` |

---

## Git Commit Standards

Use conventional commits format:

```
feat: add owner dashboard slot management
fix: resolve booking date validation bug
refactor: extract booking logic into custom hook
docs: update architecture.md with new schema
style: format code with prettier
test: add tests for booking API route
chore: update dependencies
```

**Branch naming:**
```
feature/owner-dashboard
fix/chatbot-response-bug
refactor/booking-flow
```

---

## Testing Standards (To Implement)

- **Unit tests** for utility functions (`lib/`) using Vitest/Jest
- **Component tests** for critical UI (BookingForm, PaymentForm) using React Testing Library
- **E2E tests** for core flows (signup → book → pay) using Playwright
- **Minimum coverage target:** 70% for critical paths (auth, booking, payment)

---

## File Organization

```
parkzo/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── dashboard/
│   │   └── page.tsx                # User dashboard
│   ├── book/
│   │   └── page.tsx                # Booking flow
│   ├── (owner)/                    # Route group for owner pages
│   │   └── owner-dashboard/page.tsx
│   ├── (admin)/                    # Route group for admin pages
│   │   └── admin-dashboard/page.tsx
│   └── api/
│       ├── auth/route.ts
│       ├── bookings/route.ts
│       ├── spaces/route.ts
│       └── payments/route.ts
├── components/
│   ├── ui/                         # shadcn/ui base components
│   ├── features/                   # Feature-specific components
│   │   ├── BookingCard.tsx
│   │   ├── SlotFilter.tsx
│   │   └── ChatbotWidget.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   └── forms/
│       ├── LoginForm.tsx
│       └── BookingForm.tsx
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── validators.ts
│   ├── types.ts
│   └── constants.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useBookings.ts
│   └── useSlots.ts
├── docs/                           # These 7 documentation files
├── public/
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## Protected Files (Do Not Modify Without Discussion)

- `components/ui/*` — shadcn/ui generated components (use CLI to update)
- `lib/supabase.ts` — Core Supabase client setup
- Database migration files (once applied) — never edit past migrations

---

## Code Review Checklist (Before Merging)

- [ ] TypeScript compiles with no errors (`npm run build`)
- [ ] No `console.log` left in production code
- [ ] All new API routes validate input and check auth
- [ ] Component follows naming/file conventions
- [ ] No hardcoded secrets or API keys
- [ ] Responsive on mobile (tested at 375px width minimum)
- [ ] Matches design tokens from `ui-context.md`
- [ ] `progress-tracker.md` updated

---

**Last Updated:** 2025-02-16
