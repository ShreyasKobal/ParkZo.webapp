# ParkZo - Project Overview

## Overview

ParkZo is a smart parking management platform that solves urban traffic congestion caused by inefficient parking search. Built for the Smart India Hackathon 2025 (Problem Statement SIH25050 — Smart Traffic Management System for Urban Congestion), ParkZo enables users to discover, reserve, and pay for parking slots before leaving home, eliminating on-road searching and reducing traffic by 30%. The platform will eventually support a full marketplace where parking space owners can list slots, admins monitor analytics, and users enjoy seamless booking experiences across Indian metro cities.

**Current Phase:** MVP (Users can search, book, and pay for parking). Next phases: Owner/Admin dashboards, IoT integration, nationwide expansion.

---

## Goals

1. **Immediate (Phase 1):** Stabilize and polish current user booking flow; migrate to React/Next.js for scalability.
2. **Short-term (Phase 2):** Implement Owner Dashboard (parking space owners can list/manage slots) and Admin Dashboard (platform analytics, user management).
3. **Medium-term (Phase 3):** Add real-time slot occupancy tracking (IoT), Google Maps integration, AI-powered smart suggestions.
4. **Long-term (Phase 4):** Nationwide scaling, EV charging integration, mobile app, partnership ecosystem.

---

## Core User Flows

### Current Flow (MVP - Already Implemented)
1. **User** signs up / logs in securely (Supabase Auth)
2. **User** browses available parking slots by location and vehicle type
3. **User** selects a slot and books for desired date/time
4. **User** completes payment (currently dummy/test payments)
5. **User** receives booking confirmation and can view booking history

### Future Flows (To Be Built)
**Owner Flow:**
1. Owner lists their parking space(s) with details (location, capacity, pricing)
2. Owner manages slot availability (occupancy, pricing rules)
3. Owner views bookings and earnings

**Admin Flow:**
1. Admin views platform analytics (total bookings, revenue, utilization rate)
2. Admin manages users, owners, disputes
3. Admin generates reports for city authorities

---

## Features

### Phase 1: MVP (Current - Needs Polish)
**User Features:**
- Secure authentication (signup/login/password reset)
- Browse parking slots (filter by location, vehicle type)
- Real-time slot availability display
- Book a slot (select date, time, duration)
- Dummy payment gateway integration
- View booking history and cancellations
- AI chatbot for booking help (Gemini API — currently has bugs)
- Responsive UI for mobile/desktop

### Phase 2: Owner & Admin (To Be Built)
**Owner Features:**
- Dashboard to list parking spaces
- Manage slot availability and pricing
- View bookings and earnings
- Analytics for own spaces

**Admin Features:**
- Platform dashboard with key metrics
- User and owner management
- Report generation
- System configuration

### Phase 3: Smart Features (Future)
- Google Maps integration (location search, directions)
- Real-time occupancy via IoT sensors
- AI-powered parking suggestions based on user patterns
- Dynamic pricing recommendations
- SMS/email notifications

---

## Scope

### In Scope (This Development Cycle)

1. **Refactor & Stabilize:**
   - Migrate codebase from plain HTML/CSS/JS → React/Next.js
   - Fix known bugs in chatbot and payment flows
   - Complete database schema (add missing tables for owners, locations, slots)
   - Improve error handling and loading states
   - Add responsive design (currently broken on mobile)

2. **Complete Authentication:**
   - Ensure login/signup/password reset fully work
   - Add role-based access control (User, Owner, Admin roles)
   - Implement session management and token refresh

3. **Stabilize Booking Flow:**
   - Fix booking confirmation logic
   - Real-time slot availability updates
   - Payment status tracking
   - Cancellation and refund flow

4. **Owner Dashboard (MVP):**
   - Simple interface to list parking spaces
   - Manage available slots
   - View incoming bookings

5. **Admin Dashboard (MVP):**
   - Basic analytics (total bookings, revenue)
   - User management interface

### Out of Scope (Phase 3+)

- IoT sensor integration
- Google Maps API (advanced features like routes, ETA)
- Mobile app (web-first for now)
- SMS/Email notifications (basic only)
- Machine learning and predictive analytics
- Multi-city expansion infrastructure
- Payment with UPI/card wallets (test mode only)

---

## Success Criteria

1. ✅ All current user flows work without bugs (search → book → pay → history)
2. ✅ React/Next.js migration complete with improved performance
3. ✅ Mobile responsiveness working on iOS/Android browsers
4. ✅ Owner can list 1+ parking space and view bookings
5. ✅ Admin can view basic analytics dashboard
6. ✅ Role-based access control enforced (User ≠ Owner ≠ Admin)
7. ✅ AI chatbot responds without errors
8. ✅ 95%+ test coverage on critical flows (auth, booking, payment)
9. ✅ Deployed on Vercel with zero critical bugs
10. ✅ Documentation complete for team handoff

---

## Tech Stack Decision

| Layer | Technology | Reasoning |
|-------|-----------|-----------|
| **Frontend** | React 18 + Next.js 14 | Modern, scalable, better for marketplace complexity. Learning value for 4th year. |
| **Styling** | Tailwind CSS + shadcn/ui | Professional component library, easy theming (dark/light/brand). |
| **Backend** | Supabase (PostgreSQL + Auth) | Already in use, cost-effective, real-time capable. Keep as-is. |
| **Auth** | Supabase Auth | Works. Implement role-based middleware in Next.js. |
| **APIs** | Google Maps, Gemini, Payment Gateway | Integrate via Next.js API routes for security. |
| **Deployment** | Vercel (frontend) + Supabase (backend) | Current setup. No changes needed. |
| **Database** | PostgreSQL (Supabase) | Current. Expand schema as needed. |

---

## Deployment & Availability

- **Live URL:** https://parkzowebapp.vercel.app/
- **GitHub:** https://github.com/ShreyasKobal/ParkZo.webapp.git
- **Supabase Project:** https://wapnwkqyhvdkvbqtstwt.supabase.co
- **Status:** MVP live with known issues; refactor in progress

---

## Key Metrics (To Track)

- **User sign-ups:** Target 100+ test users in first month
- **Booking completion rate:** Target 90%+ (currently ~75% due to bugs)
- **Payment success rate:** Target 95%+ (currently test-only)
- **Page load time:** <2s on 4G (currently needs optimization)
- **Mobile responsiveness:** 100% of features work on mobile
- **Uptime:** 99%+ on Vercel

---

## Next Steps

1. ✅ Finalize architecture (this document + architecture.md)
2. ✅ Define code standards and best practices
3. ✅ Set up React/Next.js project structure
4. ✅ Establish AI workflow rules for team collaboration
5. ⏳ Begin Phase 1: Refactor + stabilize (start with bug fixes)
6. ⏳ Track progress in progress-tracker.md

---

**Last Updated:** 2025-02-16  
**Next Review:** After React migration is complete
