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
- `SEARCHAPI_API_KEY` is a second alternative. It uses SearchApi.io's Google Maps engine (`google_maps`, details via `google_maps_place`) with the key sent in the `Authorization` header. Each page of up to 20 results uses one SearchApi credit, up to 3 pages per location × industry. It's used only when the two keys above are empty. Data from it is labelled "Google Maps listing (via SearchApi.io)".
- **Website check.** A Google listing's website link is often wrong. It can be an old site the business has replaced, a dead domain, a directory page (JustDial, IndiaMART…) or a retired `business.site` page. Lead Finder checks every listed link:
  - Directory, social, link-in-bio and `business.site` links are never treated as the business's website.
  - If the listing has no website, or its site looks old or doesn't load, Lead Finder searches Google for the business name and city. This uses the SearchApi.io or SerpApi key, one search credit each, up to 20 per Find Leads run and 10 per Auto Find run.
  - A site found this way is used only if it shows the listing's phone number. A site that clearly carries the business name and city but not the phone is used too, marked as an estimate. Anything else is listed under "Possible websites" for a person to check, never assumed.
  - The old listing link is kept on the lead and becomes a "Google listing links to wrong site" opportunity.
  - With only `GOOGLE_PLACES_API_KEY`, listed links are still checked, but no web search runs.
- `GOOGLE_PAGESPEED_API_KEY` is optional.
- `ANTHROPIC_API_KEY` is optional. It uses `claude-opus-5-5` with server-side fallbacks enabled (`fallbacks: "default"`), so a request can be served by a fallback model if the primary is unavailable.
- `CRON_SECRET` enables **Auto find**. On Vercel, `vercel.json` runs `/api/lead-finder/auto` daily at 09:00 IST. It runs daily/weekly saved searches that are due and adds only new, de-duplicated businesses. The Vercel Hobby plan allows one cron per day. On your own server, call that URL from cron with `Authorization: Bearer $CRON_SECRET`.

Google's Maps Platform terms limit how long Places content may be stored. Review them for your use, and use **Refresh** / re-search to keep data current.

## Website Intelligence Auditor

`/lead-finder/audit` runs a deep, evidence-based audit of any public website. Enter a URL, choose how many pages to crawl (10, 25, 50 or 100), optionally add up to 3 competitor URLs, and press **Start deep audit**. The audit shows its progress live, step by step, and results fill in as each module finishes.

**What it checks.** It crawls the site's important pages (robots.txt and crawl-delay respected; forms never submitted) and analyzes:

- performance and Core Web Vitals;
- images, fonts, JavaScript and CSS (including unused code coverage);
- mobile, plus 8 responsive breakpoints with screenshots;
- UI / visual design and first impression;
- UX and user journeys;
- conversion, lead generation and forms;
- SEO and local SEO;
- content and trust;
- accessibility (axe-core, labelled as automated findings);
- passive security (HTTPS, certificate, headers, cookies, exposed versions);
- technology;
- e-commerce (when detected);
- business-type specific expectations (real estate, restaurant, clinic, SaaS, hotel and others).

**Findings.** Every finding lists its severity (CRITICAL / HIGH / MEDIUM / LOW / INFO), evidence, impact and recommendation. It is labelled by source: HTML, response headers, crawler, Arkria browser, Google PageSpeed, real-user Chrome UX Report data, axe-core, or **AI ANALYSIS**. Anything that can't be measured says **Not measured**; nothing is estimated silently.

**The report** contains:
- an executive summary;
- 12 scores, each backed by findings;
- sections for every area above;
- a page-by-page table;
- an issue explorer (filter by severity, category, page or type; sort by severity, impact or quick wins);
- quick wins and high-impact improvements;
- cross-impact issues;
- competitor differences;
- the **Arkria opportunity** score, with the recommended and secondary services and the evidence behind them;
- internal sales intelligence: price, cost, margin, hours, lead quality, outreach angle, objections and pitch.

**Actions:**
- **Generate client report**: printable; excludes internal scoring, cost, margin and sales strategy unless you choose to include them.
- **Generate personalized pitch.**
- **Add to leads**: links the audit to the lead.
- **Create proposal**: pre-filled from the audit.

Every lead with a website also has a **Deep audit** button.

**Where it runs.** Crawling and analysis run on the server. Each step is a short request, so it also works on serverless hosting. Browser-based checks need Chrome, Edge or Chromium on the machine running the app. They work automatically when you run it locally or on your own server; on Vercel they are marked "Not measured". Google PageSpeed data is added automatically (a `GOOGLE_PAGESPEED_API_KEY` raises the quota). `ANTHROPIC_API_KEY` adds AI ANALYSIS of the screenshots and copy.

Audits are stored separately from the workspace: in `data/audits/` locally, or in the `arkria_audits` table on Supabase (re-run `supabase/schema.sql`).

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
| `/lead-finder/audit` | Website Intelligence Auditor: deep audit, competitor comparison, recent audits |
| `/lead-finder/audits/[id]` | Full audit report with actions (client report, pitch, add to leads, proposal) |
| `/lead-finder/audits/[id]/client` | Printable client-facing audit report |
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
- `src/lib/leadfinder/` holds the Lead Finder (discovery providers: Google Places, SerpApi and SearchApi.io). It contains:
  - pure engines: `engine.ts` (signals, scoring, matching), `nlp.ts`, `outreach.ts`, `dedupe.ts` and `csv.ts`;
  - `client.ts` for the browser flows;
  - `server/`, which holds the provider layer (`providers.ts`, the `LeadProvider` interface and Google Places), the website analyzer, the Claude layer and auto find.
  
  API routes live under `api/lead-finder/*` and use the same team password as the store.
- `src/lib/audit/` holds the Website Intelligence Auditor:
  - `server/`: the network guard, crawler, site probe, headless browser, PageSpeed, link checker, AI and storage;
  - `engine/`: the analyzer modules (performance, experience, conversion, seo, quality, opportunity, report);
  - `orchestrator.ts`: the step-by-step runner;
  - `technology.ts`: evidence-based technology detection.
  
  API routes live under `api/audit/*` and `api/audits`.
- `src/lib/pricing-data.ts` holds the default pricing for new workspaces. The live copy is in the database and edited in Settings.
