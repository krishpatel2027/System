# Arkria — Studio OS

Internal operating system for the Arkria studio: leads → discovery → scope → pricing → quote → proposal → projects → payments → maintenance.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4, lucide-react, recharts
- localStorage-first store with server sync (`src/lib/store.tsx` → `PUT /api/store`)

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Routes

| Route | What it does |
|---|---|
| `/` | Dashboard: follow-ups, pipeline, payments, deadlines |
| `/leads` | Lead pipeline (kanban) + audit + estimates |
| `/clients` | Clients + onboarding checklist |
| `/services` | Internal cost vs client price |
| `/packages` | Client-facing packages (full CRUD) |
| `/pricing` | Pricing Studio: 143-feature calculator, margin/contingency/rush/discount/GST → send to Quote Builder |
| `/quotes` | Quote builder (receives Pricing Studio payloads) |
| `/proposals` | Proposal documents |
| `/projects` | Projects: tasks, milestones, progress |
| `/scope` | Scope-change control (quote before building) |
| `/payments` | Payment schedules + statuses |
| `/maintenance` | Care-plan subscriptions + MRR |
| `/templates` | Message templates + communication log |
| `/analytics` | Pipeline, revenue, sources |
| `/settings` | Studio config, backup export/import, backend status |
| `/login` | Admin login (when `ARKRIA_ADMIN_PASSWORD` is set) |

## Backend

Zero-config local default, Supabase-ready for production:

1. **Local (default):** API routes persist the whole DB document to `./data/arkria.json`. The browser keeps working offline from localStorage and syncs in the background.
2. **Supabase:** create a project, run `supabase/schema.sql` once, then copy `.env.example` → `.env.local` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and `ARKRIA_ADMIN_PASSWORD` to lock `/api/store`).

Health check: `GET /api/health`.

## Project layout

- `src/app/` — routes + `api/health`, `api/store`
- `src/components/` — `shell.tsx` (nav/search/theme), `ui.tsx` (design system)
- `src/lib/` — `types.ts` (schema), `seed.ts` (demo data), `store.tsx` (client store), `server-store.ts` (file/Supabase persistence), `pricing-data.ts`, `utils.ts`
- `supabase/schema.sql` — production Postgres schema
