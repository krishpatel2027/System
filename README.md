# Arkria — Studio OS

The operating system for a web studio: leads → pricing → quotes & proposals → projects → payments → care plans, shared by the whole team.

## Quick start (your computer)

```bash
npm install
npm run dev      # http://localhost:3000
```

No setup is needed locally: data is saved to `./data/arkria.json`, and without a team password the app is open. Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`.

## Deploy for your team

Everyone uses one shared workspace. You set **one team password**. Teammates open the app's address, enter their name and the password, and changes sync for everybody within about 15 seconds. Two people editing different records never overwrite each other. If they edit the *same* field at the same moment, the last save wins.

> **Always set `ARKRIA_ADMIN_PASSWORD` and serve over HTTPS.** In production the app refuses to run without a password.

### Option A — Vercel + Supabase (recommended, free tiers work)

1. **Database:** create a project at [supabase.com](https://supabase.com). Open **SQL editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
2. **Keys:** in Supabase open **Project Settings → API** and copy the **Project URL** and the **service_role** key. The service_role key is secret; it only ever goes on the server.
3. **Hosting:** import this GitHub repo at [vercel.com/new](https://vercel.com/new). Under **Environment Variables** add:
   | Name | Value |
   |---|---|
   | `ARKRIA_ADMIN_PASSWORD` | a strong team password |
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
4. **Deploy.** Open the site, sign in, and check **Settings → Team & access**. It should say *Storage: supabase* and *Access: Team password*.

Vercel has no persistent disk, so Supabase is required there. The app detects a missing database and shows a warning instead of silently losing data.

### Option B — Your own server (VPS, office machine) with Docker

```bash
docker build -t arkria-studio .
docker run -d --name arkria -p 3000:3000 --restart unless-stopped \
  -v arkria-data:/app/data \
  -e ARKRIA_ADMIN_PASSWORD='choose-a-strong-password' \
  arkria-studio
```

Data lives in the `arkria-data` volume. Put a reverse proxy with HTTPS in front of it (for example Caddy: `your.domain { reverse_proxy localhost:3000 }`).

### Option C — Your own server without Docker

```bash
npm ci && npm run build
ARKRIA_ADMIN_PASSWORD='choose-a-strong-password' npm start   # port 3000
```

Keep it running with `pm2` or systemd. Back up the `data/` folder.

### Backups

**Settings → Data & backup → Download backup** exports everything: records, pricing and settings. **Restore from backup** puts a file back.

## What's editable in the app

- **Settings → Studio profile, Quotes & payments:** name, contact details, GSTIN, UPI and bank details, quote numbering, default GST, quote validity and payment terms.
- **Settings → Packages, Rate card, Care plans, Terms:** every price the calculator uses, what each package bundles, care plans, and which policies print on quotes.

Changes on these screens wait for the **Save changes** button. Everything else saves automatically.

## Routes

| Route | What it does |
|---|---|
| `/` | Dashboard: KPIs, pipeline, this week's follow-ups/payments/milestones, getting-started checklist |
| `/analytics` | Win rate, quote acceptance, revenue by month, lead sources |
| `/leads` | Lead board + list, lead audit and estimates, convert to client |
| `/clients` | Clients, onboarding checklist, projects and payments per client |
| `/proposals`, `/proposals/[id]` | Proposal editor and the client-facing proposal document |
| `/quotes`, `/quotes/[id]` | Quote builder and the client-facing quotation document |
| `/pricing` | Pricing calculator (package + extras + discount/GST → quote), rate card, care plans, policies |
| `/packages` | Your packages and care plans as a printable price sheet |
| `/services` | Internal cost vs price per service |
| `/projects` | Projects, tasks, milestones and automatic payment schedules |
| `/scope` | Change requests: estimate and approve before building |
| `/payments` | Invoices and milestone payments, mark paid, overdue tracking |
| `/maintenance` | Care-plan subscriptions and MRR |
| `/templates` | Message templates (fill in and send via WhatsApp or email) and conversation log |
| `/settings` | Studio details, pricing, team & access, data & backup |
| `/login` | Sign in with your name and the team password |
| `/share/[token]` | **Public** read-only link to one quote or proposal for a client |

**Sharing with clients:** on a quote or proposal, **Share with client** creates a private link that shows only that one document. Clients need no account, and **Stop sharing** turns the link off.

## How it works

- `src/app/` holds the pages. API routes: `api/store` (the workspace, versioned), `api/share/[token]` (public documents) and `api/health`.
- `src/lib/store.tsx` is the client store. It saves instantly to the browser, syncs with the server, pulls teammates' changes every 15 seconds, and merges conflicts by record (`src/lib/merge.ts`).
- `src/lib/server-store.ts` holds the file and Supabase backends, with optimistic versioning.
- `src/lib/migrate.ts` upgrades stored data from older versions.
- `src/lib/pricing-data.ts` holds the default pricing for new workspaces. The live copy is in the database and edited in Settings.
