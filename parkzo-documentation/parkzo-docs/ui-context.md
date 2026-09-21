# UI Context — ParkZo

## Theme

**Dual theme system: Light mode (current/default) + Dark mode (new) + Brand identity.**

ParkZo's visual language should feel modern, trustworthy, and tech-forward — appropriate for a smart-city infrastructure product. The design should evoke urban mobility, efficiency, and clarity. Based on the original PPT branding, ParkZo uses a **deep navy/purple** primary brand color with a **vibrant accent** (yellow/gold, as seen in the mobile mockup "Parkzo — Find Park Go!" screen with dark purple header and mint-green content areas).

**Design direction:**
- Light mode: Clean, airy, high contrast for readability (default for most users)
- Dark mode: Deep navy/near-black backgrounds with the same accent colors, easier on eyes for night use (drivers checking parking at night)
- Brand accent colors carry through both themes for consistency

---

## Colors

Define color tokens as CSS custom properties in `globals.css`. All components must use these tokens — no hardcoded hex values.

### Light Mode (Default)

| Role | CSS Variable | Value | Notes |
|------|-------------|-------|-------|
| Page background | `--bg-base` | `#FFFFFF` | Main background |
| Surface | `--bg-surface` | `#F5F6FA` | Cards, panels |
| Surface elevated | `--bg-elevated` | `#FFFFFF` | Modals, dropdowns (with shadow) |
| Primary text | `--text-primary` | `#1A1A2E` | Headings, body text |
| Muted text | `--text-muted` | `#6B7280` | Secondary text, labels |
| Primary accent (brand) | `--accent-primary` | `#2D2A5E` | Deep navy/purple (from ParkZo branding) |
| Secondary accent | `--accent-secondary` | `#FFC107` | Gold/yellow (from mobile mockup highlights) |
| Border | `--border-default` | `#E5E7EB` | Dividers, input borders |
| Error/Danger | `--state-error` | `#EF4444` | Failed payments, validation errors |
| Success | `--state-success` | `#22C55E` | Confirmed bookings, available slots |
| Warning | `--state-warning` | `#F59E0B` | Limited availability, pending status |

### Dark Mode

| Role | CSS Variable | Value | Notes |
|------|-------------|-------|-------|
| Page background | `--bg-base` | `#0F0E1A` | Near-black with purple tint |
| Surface | `--bg-surface` | `#1A1930` | Cards, panels |
| Surface elevated | `--bg-elevated` | `#252341` | Modals, dropdowns |
| Primary text | `--text-primary` | `#F5F5FA` | Headings, body text |
| Muted text | `--text-muted` | `#9CA3AF` | Secondary text, labels |
| Primary accent (brand) | `--accent-primary` | `#6C63FF` | Brighter purple for dark bg contrast |
| Secondary accent | `--accent-secondary` | `#FFD60A` | Brighter gold for dark bg contrast |
| Border | `--border-default` | `#332F52` | Dividers, input borders |
| Error/Danger | `--state-error` | `#F87171` | Failed payments, validation errors |
| Success | `--state-success` | `#4ADE80` | Confirmed bookings, available slots |
| Warning | `--state-warning` | `#FBBF24` | Limited availability, pending status |

**Vehicle type / status indicators (both themes):**
| Status | Color | Usage |
|--------|-------|-------|
| Available | `--state-success` | Slot availability badges |
| Limited | `--state-warning` | Low availability badges |
| Full/Unavailable | `--state-error` | No slots badges |

---

## Typography

| Role | Font | Variable |
|------|------|----------|
| UI text (headings, body) | Inter | `--font-sans` |
| Numbers/data (prices, times) | Inter (tabular nums) | `--font-sans` with `font-variant-numeric: tabular-nums` |
| Code/technical (if needed) | JetBrains Mono | `--font-mono` |

**Type scale:**
| Element | Size | Weight |
|---------|------|--------|
| H1 (page titles) | `text-3xl` (30px) | `font-bold` |
| H2 (section headers) | `text-2xl` (24px) | `font-semibold` |
| H3 (card titles) | `text-lg` (18px) | `font-semibold` |
| Body | `text-base` (16px) | `font-normal` |
| Small/labels | `text-sm` (14px) | `font-medium` |
| Caption/muted | `text-xs` (12px) | `font-normal` |

---

## Border Radius

| Context | Class |
|---------|-------|
| Inline / small UI (badges, chips) | `rounded-md` (6px) |
| Buttons, inputs | `rounded-lg` (8px) |
| Cards / panels | `rounded-xl` (12px) |
| Modals / overlays | `rounded-2xl` (16px) |
| Avatar/profile images | `rounded-full` |

---

## Component Library

**shadcn/ui on top of Tailwind CSS.** Components live in `components/ui/`. Use the shadcn CLI to add new components rather than writing from scratch:

```bash
npx shadcn-ui@latest add button card dialog input select badge
```

**Core components needed for ParkZo:**
- `Button` — primary, secondary, destructive, ghost variants
- `Card` — for parking slot listings, booking summaries
- `Input` / `Select` — forms (login, signup, booking)
- `Dialog` / `Modal` — booking confirmation, payment flow
- `Badge` — availability status (Available/Limited/Full)
- `Tabs` — vehicle type selector (2-wheeler/4-wheeler)
- `Avatar` — user profile
- `Toast` — success/error notifications
- `Skeleton` — loading states
- `DatePicker` / `TimePicker` — booking date/time selection

---

## Layout Patterns

- **Landing/Home:** Hero section with search bar, featured parking spaces below, full-width sections
- **Dashboard (User/Owner/Admin):** Sidebar navigation (collapsible on mobile) + main content area with cards/tables
- **Booking Flow:** Multi-step wizard (Select Location → Select Slot → Confirm & Pay → Confirmation), progress indicator at top
- **Forms (Login/Signup):** Centered card, max-width 400px, single column
- **Modals:** Centered overlay with backdrop blur (`backdrop-blur-sm`), close button top-right
- **Navbar:** Top bar with bottom border, logo left, nav links center/right, user avatar/menu far right
- **Mobile Navigation:** Bottom tab bar (matches PPT mockup: Home, Search, Premium, History icons)

---

## Icons

**Lucide React.** Stroke-based icons only, consistent with shadcn/ui ecosystem.

**Sizing:**
- Inline (within text): `h-4 w-4`
- Buttons: `h-5 w-5`
- Feature cards/empty states: `h-8 w-8` or `h-12 w-12`

**Key icons for ParkZo:**
- `MapPin` — location
- `Car` — 4-wheeler vehicle type
- `Bike` — 2-wheeler vehicle type
- `Calendar` — booking date
- `Clock` — booking time
- `CreditCard` — payment
- `CheckCircle` — success/confirmed
- `AlertCircle` — warnings/errors
- `User` — profile/account
- `Settings` — settings/preferences
- `Search` — search functionality
- `Bell` — notifications
- `MessageCircle` — chatbot

---

## Spacing Scale

Use Tailwind's default spacing scale consistently:
- Tight spacing (within components): `gap-2`, `p-2` (8px)
- Standard spacing (between elements): `gap-4`, `p-4` (16px)
- Section spacing: `gap-8`, `py-8` (32px)
- Page-level spacing: `py-12` to `py-16` (48-64px)

---

## Responsive Breakpoints

Follow Tailwind defaults, mobile-first approach:

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| Base (mobile) | `<640px` | Default styles, single column |
| `sm:` | `≥640px` | Large phones |
| `md:` | `≥768px` | Tablets, 2-column layouts |
| `lg:` | `≥1024px` | Desktop, sidebar layouts |
| `xl:` | `≥1280px` | Large desktop, max content width |

**Critical mobile requirements:**
- Bottom navigation bar for primary actions (matches PPT mockup)
- Touch targets minimum 44x44px
- Forms single-column on mobile
- Cards stack vertically on mobile, grid on desktop

---

## Animation & Transitions

- Keep animations subtle and fast (150-300ms)
- Use Tailwind's built-in transition utilities: `transition-colors`, `transition-transform`
- Loading states: skeleton screens over spinners where possible
- Page transitions: fade-in for content, no jarring layout shifts

---

## Accessibility Requirements

- Minimum contrast ratio 4.5:1 for text (WCAG AA)
- All interactive elements keyboard-navigable
- Form inputs have associated labels
- Icons paired with text or `aria-label` for screen readers
- Focus states visible on all interactive elements

---

**Last Updated:** 2025-02-16  
**Note:** Exact hex values for brand colors should be refined once final logo/brand assets are finalized. Current values are estimated from the SIH PPT mobile mockup.
