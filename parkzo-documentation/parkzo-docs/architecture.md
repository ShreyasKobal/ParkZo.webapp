# Architecture Context — ParkZo

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend Framework** | Next.js 14 + React 18 | Server & client components, API routes, built-in optimization |
| **UI/Styling** | Tailwind CSS + shadcn/ui | Responsive, themeable, professional component library |
| **Language** | TypeScript | Type safety, better DX, fewer runtime bugs |
| **State Management** | React Context + Zustand (for complex state) | Lightweight, no Redux boilerplate |
| **Database** | Supabase (PostgreSQL) | Managed PostgreSQL with real-time, auth, and RLS |
| **Authentication** | Supabase Auth + NextAuth.js (for roles) | JWT-based, secure, built-in multi-provider support |
| **APIs** | Next.js API Routes | Secure backend-for-frontend pattern |
| **External APIs** | Google Maps, Gemini AI, Payment Gateway | Called via Next.js routes for security |
| **Hosting** | Vercel (frontend) | Optimal for Next.js, fast deployments, edge functions |
| **Deployment** | GitHub → Vercel (auto), Supabase (database) | CI/CD via GitHub, no manual deploys |

---

## System Boundaries

Each folder owns and is responsible for specific concerns:

- **`app/`** — Next.js App Router structure
  - `app/page.tsx` — Landing/home page
  - `app/dashboard/` — User dashboard (bookings, profile)
  - `app/auth/` — Login, signup, password reset pages
  - `app/book/` — Booking flow pages
  - `app/(owner)/` — Owner dashboard (future Phase 2)
  - `app/(admin)/` — Admin dashboard (future Phase 2)
  - `app/api/` — Backend API routes (auth, bookings, payments, users)

- **`components/`** — Reusable UI components
  - `components/ui/` — Base components (Button, Card, Modal, etc.) from shadcn/ui
  - `components/features/` — Feature-specific components (BookingCard, SlotFilter, etc.)
  - `components/layout/` — Layout components (Navbar, Sidebar, Footer)
  - `components/forms/` — Form components with validation

- **`lib/`** — Shared utilities and helpers
  - `lib/supabase.ts` — Supabase client initialization
  - `lib/auth.ts` — Authentication helpers
  - `lib/api-client.ts` — API call helpers with error handling
  - `lib/types.ts` — Shared TypeScript types
  - `lib/constants.ts` — App-wide constants (parking types, roles, etc.)
  - `lib/validators.ts` — Input validation schemas (Zod)

- **`hooks/`** — Custom React hooks
  - `hooks/useAuth.ts` — Auth context hook
  - `hooks/useBookings.ts` — Fetch user bookings
  - `hooks/useSlots.ts` — Fetch available slots
  - `hooks/useUser.ts` — Fetch user profile

- **`styles/`** — Global styles and Tailwind config
  - `globals.css` — Global styles and CSS variables
  - `tailwind.config.ts` — Tailwind configuration (colors, themes)

- **`docs/`** — Project documentation (these 7 files)
  - `project-overview.md` — What we're building
  - `architecture.md` — How it's structured (this file)
  - `code-standards.md` — How to write code
  - `ai-workflow-rules.md` — How AI helps development
  - `progress-tracker.md` — What's done, in-progress, next
  - `ui-context.md` — Design tokens and UI guidelines
  - `README.md` — Quick start guide

- **`public/`** — Static assets
  - Images, logos, fonts

---

## Storage Model

### Database (Supabase PostgreSQL)

**Current Tables (MVP):**

1. **auth.users** (Supabase managed)
   - id, email, encrypted_password, email_confirmed_at, created_at

2. **public.profiles**
   - `id` (uuid, PK) → `auth.users.id` (FK)
   - `user_id` (uuid) — duplicate of id for easy querying
   - `full_name` (text)
   - `role` (text enum: 'user' | 'owner' | 'admin')
   - `membership` (text enum: 'free' | 'premium' | 'business')
   - `created_at` (timestamptz)

3. **public.parking_bookings**
   - `id` (uuid, PK)
   - `user_id` (uuid, FK → profiles.user_id)
   - `customer_name` (text)
   - `vehicle_number` (text)
   - `vehicle_type` (text enum: '2_wheeler' | '4_wheeler')
   - `location` (text)
   - `booking_date` (date)
   - `start_time` (time)
   - `end_time` (time)
   - `amount_paid` (numeric)
   - `payment_status` (text enum: 'pending' | 'completed' | 'failed' | 'refunded')
   - `payment_time` (timestamptz)
   - `created_at` (timestamptz)

**Tables To Add (Phase 2):**

4. **parking_spaces** (Owners list their spaces)
   - `id` (uuid, PK)
   - `owner_id` (uuid, FK → profiles.user_id)
   - `name` (text) — e.g., "City Center Garage"
   - `location` (text) — address
   - `latitude` (float) — for maps
   - `longitude` (float) — for maps
   - `capacity` (int) — total slots
   - `hourly_rate` (numeric)
   - `available_slots` (int) — current availability
   - `features` (jsonb) — ["covered", "24-hour", "security_camera"]
   - `created_at` (timestamptz)

5. **parking_slots**
   - `id` (uuid, PK)
   - `space_id` (uuid, FK → parking_spaces.id)
   - `slot_number` (text) — e.g., "A-01"
   - `is_occupied` (boolean)
   - `vehicle_type_allowed` (text enum: 'both' | '2_wheeler' | '4_wheeler')
   - `last_updated` (timestamptz)

6. **reviews** (User ratings)
   - `id` (uuid, PK)
   - `booking_id` (uuid, FK → parking_bookings.id)
   - `user_id` (uuid, FK → profiles.user_id)
   - `space_id` (uuid, FK → parking_spaces.id)
   - `rating` (int, 1-5)
   - `comment` (text)
   - `created_at` (timestamptz)

### Row Level Security (RLS)

**Policies to Implement:**

- Users can only view/edit their own profile
- Users can only view their own bookings
- Owners can only view/edit their own parking spaces
- Admins can view all data
- All writes require authentication

### File Storage (Future)

- Parking space photos → Supabase Storage bucket `parking-space-images/`
- User profile pictures → Supabase Storage bucket `user-avatars/`

---

## Authentication & Access Model

### How Authentication Works

1. User signs up with **email + password** via Supabase Auth
2. Supabase creates `auth.users` entry + issues JWT
3. Next.js middleware validates JWT on every request
4. User profile created in `profiles` table on first login
5. Role assigned in `profiles.role` (default: 'user')

### How Ownership Works

- Every parking space is owned by exactly one user (via `parking_spaces.owner_id`)
- Every booking belongs to exactly one user (via `parking_bookings.user_id`)
- Ownership is immutable (can't transfer ownership)

### How Access Control Works

**User Role Can:**
- ✅ View their own profile
- ✅ Search/browse all parking spaces
- ✅ Create bookings
- ✅ View their own bookings
- ✅ Cancel their own bookings
- ✅ Leave reviews
- ❌ Cannot view other users' bookings
- ❌ Cannot manage parking spaces

**Owner Role Can:**
- ✅ Do everything User can do
- ✅ Create/edit parking spaces
- ✅ View their own spaces and bookings for those spaces
- ✅ Update pricing and availability
- ✅ View earnings/analytics for their spaces
- ❌ Cannot manage other owners' spaces

**Admin Role Can:**
- ✅ Do everything
- ✅ View all users, bookings, spaces
- ✅ Suspend/delete users or spaces
- ✅ View platform-wide analytics
- ✅ Manage system configuration
- ✅ Resolve disputes

---

## System Invariants

1. **Auth Required:** No API endpoint returns user-specific data without valid JWT token
2. **Ownership Enforced:** Users can only read/modify their own data (except public parking space listings)
3. **Booking Atomicity:** A booking must atomically create booking record + update slot occupancy (or fail entirely, no partial writes)
4. **Role Consistency:** A user can only have one role. Admin > Owner > User in permission hierarchy.
5. **Payment Immutability:** Once payment_status = 'completed', the booking cannot be modified (refund only via new flow)
6. **Location Accuracy:** All parking spaces must have valid latitude/longitude for maps to work
7. **No Orphaned Data:** If a user is deleted, all their bookings and spaces are archived (soft-delete), not hard-deleted
8. **Schema Versioning:** Database migrations tracked in `/migrations/` folder; never modify live schema without migration file

---

## Data Flow Diagram

```
┌─────────────────┐
│  React Frontend │ (Next.js browser, TypeScript)
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────────────────┐
│  Next.js API Routes         │ (Backend for Frontend)
│ • POST /api/auth/...        │
│ • GET /api/bookings         │
│ • POST /api/bookings        │
│ • GET /api/spaces           │
│ • POST /api/payments        │
└────────┬────────────────────┘
         │ HTTPS (with JWT)
         ↓
┌─────────────────────────────┐
│  Supabase (PostgreSQL)      │
│ • profiles                  │
│ • parking_bookings          │
│ • parking_spaces (future)   │
│ • reviews (future)          │
│ • RLS policies enforced     │
└────────┬────────────────────┘
         │ HTTPS
         ↓
┌─────────────────────────────┐
│  External Services          │
│ • Google Maps API           │
│ • Gemini AI API             │
│ • Payment Gateway API       │
└─────────────────────────────┘
```

---

## Deployment Architecture

```
GitHub Repo (ParkZo.webapp)
    ↓
Push to main branch
    ↓
GitHub Actions → Run tests & lint
    ↓
Vercel → Auto-deploy on push
    ↓
https://parkzowebapp.vercel.app/ (Live)

Supabase Database runs independently
    ↓
PostgreSQL instance
    ↓
Real-time updates via Supabase subscription
```

---

## Error Handling Strategy

- **Client Errors (4xx):** User input validation, show friendly messages
- **Server Errors (5xx):** Log to Sentry/console, show generic "something went wrong" message
- **Network Errors:** Retry logic with exponential backoff; show "connection lost" message
- **Auth Errors:** Redirect to login; refresh JWT automatically
- **Payment Errors:** Show error, allow retry; never leave booking in pending state

---

## Performance Considerations

- Use Next.js Image component for optimization
- Code split at route level (automatic in Next.js)
- Supabase queries use indexing on frequently filtered columns (user_id, location, booking_date)
- Implement pagination for large result sets
- Client-side caching via React Query or SWR for API calls
- Use Tailwind's JIT compilation for minimal CSS bundle

---

**Last Updated:** 2025-02-16  
**Architecture Version:** 1.0 (MVP with Phase 2 plans)
