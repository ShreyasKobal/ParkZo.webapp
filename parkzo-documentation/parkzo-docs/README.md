# ParkZo 🅿️

**Smart Parking Management Platform** — Find, Park, Go.

> Originally built for Smart India Hackathon 2025 (SIH25050 — Smart Traffic Management System for Urban Congestion) by Team CipherXcoder. Now being developed as a 4th-year engineering final year project.

---

## 📋 What is ParkZo?

ParkZo solves urban traffic congestion caused by vehicles roaming in search of parking (responsible for ~30% of city traffic congestion in India). It lets users search, book, and pay for parking slots in advance — before they even leave home — while enabling parking space owners to list and manage their spaces, and admins to monitor the whole platform.

**Live Demo:** https://parkzowebapp.vercel.app/  
**GitHub:** https://github.com/ShreyasKobal/ParkZo.webapp.git  
**Backend:** Supabase (PostgreSQL + Auth)

---

## 📚 Documentation Guide

This project follows a **documentation-driven development workflow**. Before writing any code, read these files in order:

| File | Purpose | Read This When... |
|------|---------|-------------------|
| **[project-overview.md](./project-overview.md)** | What we're building, goals, scope, success criteria | Starting fresh, or unsure what's in/out of scope |
| **[architecture.md](./architecture.md)** | System design, tech stack, database schema, boundaries | Adding a new feature, table, or API route |
| **[code-standards.md](./code-standards.md)** | How to write code — conventions, patterns, file organization | Before writing any code |
| **[ui-context.md](./ui-context.md)** | Design system — colors, typography, components, layout | Building any UI/frontend work |
| **[ai-workflow-rules.md](./ai-workflow-rules.md)** | How AI-assisted development works on this project | Understanding the collaboration process |
| **[progress-tracker.md](./progress-tracker.md)** | Current status, what's done, what's next, open questions | Every session — check this FIRST |

**Golden rule:** `progress-tracker.md` is the single source of truth for "what's happening right now." Always check it before starting work, and always update it after finishing.

---

## 🎯 Project Status

**Current Phase:** Phase 1 — Stabilization & React/Next.js Migration (Starting)

See [progress-tracker.md](./progress-tracker.md) for detailed current status, completed work, and next steps.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth) |
| APIs | Google Maps, Gemini AI, Payment Gateway |
| Hosting | Vercel |
| Version Control | Git + GitHub |

Full details in [architecture.md](./architecture.md).

---

## 🚀 Getting Started (Local Development)

```bash
# Clone the repo
git clone https://github.com/ShreyasKobal/ParkZo.webapp.git
cd ParkZo.webapp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL, Anon Key, Google Maps API key, Gemini API key

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## 🗂️ Project Structure

```
parkzo/
├── app/                 # Next.js pages & API routes
├── components/          # Reusable UI components
├── lib/                 # Utilities, Supabase client, types
├── hooks/               # Custom React hooks
├── docs/                # This documentation (7 files)
├── public/              # Static assets
└── styles/              # Global CSS, Tailwind config
```

Full breakdown in [code-standards.md](./code-standards.md#file-organization).

---

## 👥 Team

**Team Name:** CipherXcoder  
**Team ID:** 62720 (Smart India Hackathon 2025)  
**Team Size:** 2-3 developers  
**Original Problem Statement:** SIH25050 — Smart Traffic Management System for Urban Congestion  
**Theme:** Transportation & Logistics

---

## 🔐 Environment Variables

Required in `.env.local` (never commit this file):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
GEMINI_API_KEY=your_gemini_key
PAYMENT_GATEWAY_KEY=your_payment_key
```

---

## 🤖 Automated Maintenance

A GitHub Actions workflow (`.github/workflows/keep-supabase-alive.yml`) pings the Supabase database daily to prevent free-tier auto-pause due to inactivity. No action needed — runs automatically.

---

## 📈 Roadmap

- **Phase 1:** Stabilize MVP, migrate to Next.js, fix known bugs
- **Phase 2:** Owner Dashboard, Admin Dashboard, role-based access
- **Phase 3:** Google Maps integration, real-time slot tracking, AI suggestions
- **Phase 4:** Mobile app, EV charging integration, nationwide scaling

Full details in [project-overview.md](./project-overview.md).

---

## 📝 Contributing (Team Workflow)

1. Check [progress-tracker.md](./progress-tracker.md) for current priorities
2. Create a branch: `feature/your-feature-name` or `fix/bug-description`
3. Follow conventions in [code-standards.md](./code-standards.md)
4. Test your changes end-to-end before committing
5. Update [progress-tracker.md](./progress-tracker.md) with what you completed
6. Open a PR with a clear description

---

## 📄 License

Educational project — Smart India Hackathon 2025 / Academic Final Year Project.

---

**Last Updated:** 2025-02-16
