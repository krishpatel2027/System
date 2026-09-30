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

## Lead Finder

**Lead Finder** (`/lead-finder`) answers *who should Arkria contact next, why, with what service, and how*.

**Flow:** discover → filter → analyze → score → match service → review → outreach → track.

1. **Discover.** Search by locations (several at once), industries (or a custom one) and filters. You can also type in plain English: *"interior designers in Ahmedabad and Surat without a website under 50k"*.
2. **Analyze.** Each business website is checked for:
   - mobile support and speed;
   - SEO basics and HTTPS;
   - calls to action, forms and WhatsApp;
   - signs of age, and published contact details.
   
   Every finding records the issue, the evidence and the improvement. Only the homepage and robots.txt are read, and a robots.txt "Disallow" is honoured.
3. **Score.** The **Arkria Opportunity Score** is your own prioritisation, not an objective rating. It weighs six factors: website opportunity, digital presence, business maturity, contactability, service fit and project value. Weights and thresholds live in **Settings → Lead scoring**.
4. **Match.** Each business gets the service its evidence points to, with price, hours, cost, margin and the reasons. Signals, ideal industries and budgets are edited per service in **Services**.
5. **Outreach.** Drafts for WhatsApp, email, Instagram, LinkedIn and a call script, plus a 30-second mini audit. Drafts follow observation → opportunity → solution → call to action. **Nothing is ever sent automatically**: *Open in WhatsApp/email* only prepares a message for a person to send.
6. **Track.** *Add to pipeline* creates a lead with the stage history. The pipeline (`/leads`) runs New → Qualified → Contacted → Replied → Meeting → Proposal → Negotiation → Won/Lost, with conversion rates and potential pipeline value (not guaranteed revenue).

**Honest data.** Every fact shows its source and one of four labels: **Verified** (published by the business on Google or entered by your team), **Detected** (read from its website), **Estimated**, or **Not found**. Emails are never guessed. Employee counts and revenue are never invented. Decision makers are only what your team adds, with a public source link.

**Also included:**
- Duplicate detection by Google place id, domain, phone and name + city.
- CSV import. Columns: Business Name, Industry, Location, Website, Phone, Email, Instagram, LinkedIn, Notes.
- CSV/Excel and PDF export.
- A standalone Website auditor.
- Saved searches with search history.
- Lead alerts in the bell for new high-opportunity businesses.
- Command Center and Analytics views: lead funnel and service demand.

**Setup.** See `.env.example` → Lead Finder.

- `GOOGLE_PLACES_API_KEY` turns on discovery through Places API (New) Text Search. Up to 60 results per location × industry, billed by Google per request.
- `SERPAPI_API_KEY` is the alternative. It uses SerpApi's Google Maps engine and returns the same listing data. Each page of up to 20 results uses one SerpApi search credit, up to 3 pages per location × industry. It's used only when `GOOGLE_PLACES_API_KEY` is empty. Data from it is labelled "Google Maps listing (via SerpApi)".
- `GOOGLE_PAGESPEED_API_KEY` is optional.
- `ANTHROPIC_API_KEY` is optional. It uses `claude-opus-5-5` with server-side fallbacks enabled (`fallbacks: "default"`), so a request can be served by a fallback model if the primary is unavailable.
- `CRON_SECRET` enables **Auto find**. On Vercel, `vercel.json` runs `/api/lead-finder/auto` daily at 09:00 IST. It runs daily/weekly saved searches that are due and adds only new, de-duplicated businesses. The Vercel Hobby plan allows one cron per day. On your own server, call that URL from cron with `Authorization: Bearer $CRON_SECRET`.

Google's Maps Platform terms limit how long Places content may be stored. Review them for your use, and use **Refresh** / re-search to keep data current.

## What's editable in the app

- **Settings → Studio profile, Quotes & payments:** name, contact details, GSTIN, UPI and bank details, quote numbering, default GST, quote validity and payment terms.
- **Settings → Packages, Rate card, Care plans, Terms:** every price the calculator uses, what each package bundles, care plans, and which policies print on quotes.

Changes on these screens wait for the **Save changes** button. Everything else saves automatically.

## Routes

| Route | What it does |
|---|---|
| `/` | Command Center: who to contact next, growth engine (7 days), KPIs, pipeline, this week's follow-ups/payments/milestones |
| `/analytics` | Win rate, quote acceptance, revenue by month, lead funnel, service demand, lead sources |
| `/lead-finder` | Discover businesses: smart search, filters, FIND LEADS, today's opportunities, CSV import, manual add |
| `/lead-finder/[id]` | Lead intelligence: why this lead, recommended service, website audit, outreach drafts, mini audit, sourced business data |
| `/lead-finder/database` | Every discovered business with filters, bulk analyze, add to pipeline, CSV/PDF export |
| `/lead-finder/audit` | Website auditor for any URL |
| `/lead-finder/searches` | Saved searches, search history, auto find |
| `/leads` | Pipeline board + list (9 stages), conversion rates, lead audit and estimates, convert to client |
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
| `/settings` | Studio details, pricing, lead scoring, integrations, team & access, data & backup |
| `/login` | Sign in with your name and the team password |
| `/share/[token]` | **Public** read-only link to one quote or proposal for a client |

**Sharing with clients:** on a quote or proposal, **Share with client** creates a private link that shows only that one document. Clients need no account, and **Stop sharing** turns the link off.

## How it works

- `src/app/` holds the pages. API routes: `api/store` (the workspace, versioned), `api/share/[token]` (public documents) and `api/health`.
- `src/lib/store.tsx` is the client store. It saves instantly to the browser, syncs with the server, pulls teammates' changes every 15 seconds, and merges conflicts by record (`src/lib/merge.ts`).
- `src/lib/server-store.ts` holds the file and Supabase backends, with optimistic versioning.
- `src/lib/migrate.ts` upgrades stored data from older versions.
- `src/lib/leadfinder/` holds the Lead Finder (discovery providers: Google Places and SerpApi). It contains:
  - pure engines: `engine.ts` (signals, scoring, matching), `nlp.ts`, `outreach.ts`, `dedupe.ts` and `csv.ts`;
  - `client.ts` for the browser flows;
  - `server/`, which holds the provider layer (`providers.ts`, the `LeadProvider` interface and Google Places), the website analyzer, the Claude layer and auto find.
  
  API routes live under `api/lead-finder/*` and use the same team password as the store.
- `src/lib/pricing-data.ts` holds the default pricing for new workspaces. The live copy is in the database and edited in Settings.
