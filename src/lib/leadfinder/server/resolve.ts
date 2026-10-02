import type { Confidence, SourceId, WebsiteAudit, WebsiteCheck, WebsiteStatus } from "../../types";
import { guardedFetch, normalizeUrl, readCapped, robotsCheck } from "../../audit/server/net";
import { classifyAudit } from "../engine";
import { analyzeHtml, analyzeWebsite, visibleText } from "./analyzer";
import { marketOf, nationalNumber } from "../markets";
import { activeProvider, ProviderError, webSearcher, type LeadProvider } from "./providers";

// Works out which website really belongs to a business.
//
// A Google listing's "website" link is often stale: it can point at an old
// site the business has since replaced, a dead domain, a directory page or a
// retired Google Business Profile site. When that happens we search Google for
// the business and only accept a site that shows the listing's phone number,
// or (marked as an estimate) clearly carries its name and city. Nothing is
// guessed: unconfirmed sites are listed as candidates for a person to check.

export interface ResolveInput {
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
  placeId?: string;
  country?: string;
  allowSearch?: boolean;
}

export interface ResolveResult {
  website?: string;            // the site to use; undefined means the business has none we can confirm
  websiteSource?: SourceId;
  websiteConfidence?: Confidence;
  audit?: WebsiteAudit;
  // Filled from the provider's place details when the listing search left them empty.
  phone?: string;
  address?: string;
  country?: string;
  detailsSource?: LeadProvider["id"];
  check: WebsiteCheck;
}

// Links that are not the business's own website.
const NOT_OWN: [RegExp, string][] = [
  [/(^|\.)business\.site$/i, "a Google Business Profile website (Google shut these down in 2024)"],
  [/(^|\.)(justdial|indiamart|sulekha|tradeindia|exportersindia|magicbricks|99acres|housing|nobroker|commonfloor|squareyards|makaan|zomato|swiggy|dineout|eazydiner|practo|lybrate|credihealth|urbancompany|urbanclap|yelp|tripadvisor|booking|makemytrip|goibibo|agoda|asklaila|grotal|yellowpages|clickindia|quikr|olx|amazon|flipkart|meesho|weddingwire|wedmegood|shaadisaga|zaubacorp|tofler|glassdoor|naukri|ambitionbox|bbb|angi|angieslist|thumbtack|houzz|trustpilot|foursquare|manta|superpages|nextdoor|cylex|yell|192|checkatrade|trustatrader|hotfrog|truelocal|localsearch|whitepages|dnb|opencorporates|zillow|realtor|rightmove|zoopla|domain|realestate|bayut|propertyfinder|dubizzle|talabat|deliveroo|ubereats|doordash|grubhub|opentable|healthgrades|zocdoc|webmd|vitals|doctify|whatclinic|treatwell|fresha|booksy|mindbody|yellowpages-uae|dubaiyellowpages|expatwoman|ratedpeople|mybuilder|hipages|serviceseeking|oneflare|airtasker|crunchbase|zoominfo|rocketreach|signalhire|clutch|goodfirms|designrush)\.[a-z.]{2,}$/i, "a directory or marketplace page"],
  [/(^|\.)(facebook|instagram|linkedin|youtube|twitter|x|threads|pinterest|tiktok|fb)\.(com|me)$/i, "a social media page"],
  [/(^|\.)(linktr\.ee|wa\.me|whatsapp\.com|bit\.ly|tinyurl\.com|goo\.gl|g\.page|g\.co|maps\.app\.goo\.gl|bio\.link|beacons\.ai)$/i, "a link-in-bio, shortener or chat link"],
  [/(^|\.)(wikipedia\.org|wikimapia\.org|mapquest\.com|waze\.com)$/i, "a reference page"],
];

const hostOf = (u: string) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).host.toLowerCase(); } catch { return ""; } };
const bare = (h: string) => h.replace(/^www\./, "");

export function notOwnSite(url: string): string | null {
  const h = hostOf(url).replace(/:\d+$/, "");
  if (!h) return "an invalid address";
  if (h === "sites.google.com") return null;
  if (/(^|\.)google\.[a-z.]+$/i.test(h)) return "a Google page";
  return NOT_OWN.find(([re]) => re.test(h))?.[1] ?? null;
}

// Words that don't identify a business on their own.
const GENERIC = new Set(("the and for with pvt private ltd limited llp llc pllc pty plc fze fzco fzc dmcc wll co company corp corporation inc group india indian usa america british australian canadian services service solutions solution " +
  "enterprises enterprise agency agencies associates studio studios consultants consultancy consulting center centre shop store stores mart clinic clinics hospital " +
  "estate estates real realty realtors properties property developers developer builders builder construction constructions interiors interior design designs designer " +
  "designers architects architect architecture salon spa gym fitness cafe restaurant kitchen hotel hotels classes academy institute school education travels travel tours " +
  "dental dentist doctor dr care health medical traders trading industries industry works brothers sons official home homes furniture decor jewellers jewellery fashion boutique").split(/\s+/));

export function nameTokens(name: string): string[] {
  return [...new Set(name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length >= 4 && !GENERIC.has(t) && !/^\d+$/.test(t)))];
}

// Every phone number on the page, as the number without country code, so
// "+971 4 123 4567" on the site matches "04 123 4567" on the listing.
function pagePhones(html: string, text: string, country?: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) { const d = nationalNumber(decodeURIComponent(m[1]), country); if (d) out.add(d); }
  for (const m of text.matchAll(/\+?\(?\d[\d\s().\/-]{6,18}\d/g)) { const d = nationalNumber(m[0], country); if (d) out.add(d); }
  return out;
}

interface Page { url: URL; html: string; status: number; ms: number }

async function fetchPage(u: URL): Promise<Page | null> {
  try {
    if (!(await robotsCheck(u))) return null;
    const t0 = Date.now();
    const { res, url } = await guardedFetch(u, { accept: "text/html,application/xhtml+xml", timeout: 10_000 });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml/i.test(type)) return null;
    const html = (await readCapped(res, 1_500_000)).text;
    return html.trim() ? { url, html, status: res.status, ms: Date.now() - t0 } : null;
  } catch {
    return null;
  }
}

// analyzeWebsite only throws for addresses it can't parse; treat those as unreachable.
async function analyzeSafe(url: string, country?: string): Promise<WebsiteAudit> {
  try { return await analyzeWebsite(url, { country }); }
  catch (e) { return { url, analyzedAt: new Date().toISOString(), ok: false, error: (e as Error).message || "Invalid address.", scores: {}, findings: [], found: { phones: [], emails: [], socials: {}, hasViewport: false, hasForm: false, hasCta: false, hasChatWidget: false, hasCart: false, sellsProducts: false, internalLinks: 0 } }; }
}

const auditOf = (p: Page, country?: string): WebsiteAudit => ({ url: p.url.toString(), analyzedAt: new Date().toISOString(), ...analyzeHtml(p.html, { url: p.url.toString(), finalUrl: p.url.toString(), status: p.status, responseMs: p.ms, country }) });

interface Match { kind: "phone" | "name"; detail: string }

export function identify(page: { url: URL; html: string }, b: { name: string; city?: string; phones: string[]; country?: string }): { match: Match | null; partial: boolean } {
  const text = visibleText(page.html).toLowerCase();
  const title = (page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").toLowerCase();
  const want = b.phones.map((p) => nationalNumber(p, b.country)).filter(Boolean);
  if (want.length) {
    const found = pagePhones(page.html, text, b.country);
    const hit = want.find((d) => found.has(d));
    if (hit) return { match: { kind: "phone", detail: `it shows the same phone number as the Google listing (ending ${hit.slice(-4)})` }, partial: false };
  }
  const tokens = nameTokens(b.name);
  if (!tokens.length) return { match: null, partial: false };
  const inPage = tokens.every((t) => text.includes(t) || title.includes(t));
  const host = bare(page.url.hostname);
  const inHostOrTitle = tokens.some((t) => host.includes(t) || title.includes(t));
  const city = (b.city ?? "").toLowerCase().trim();
  const cityOk = !!city && text.includes(city);
  if (inPage && inHostOrTitle && cityOk) return { match: { kind: "name", detail: `its name and city match (${b.name}, ${b.city}), but the listing's phone number wasn't found on it` }, partial: false };
  return { match: null, partial: inPage };
}

function whyOld(a: WebsiteAudit): string {
  if (!a.ok) return a.error ?? "it didn't load";
  const bits: string[] = [];
  if (!a.found.hasViewport) bits.push("not mobile-friendly");
  const legacy = a.findings.find((f) => f.id === "legacy_markup");
  if (legacy) bits.push(legacy.evidence.replace(/\.$/, "").toLowerCase());
  if (a.found.copyrightYear && a.found.copyrightYear <= new Date().getFullYear() - 3) bits.push(`footer says © ${a.found.copyrightYear}`);
  if (!(a.finalUrl ?? a.url).startsWith("https://")) bits.push("no HTTPS");
  return bits.length ? `it looks like an older site (${bits.slice(0, 3).join("; ")})` : "it looks like an older site";
}

const RANK: Record<WebsiteStatus, number> = { good: 3, basic: 2, unchecked: 1, outdated: 0, unreachable: -1, none: -1 };

export async function resolveWebsite(input: ResolveInput): Promise<ResolveResult> {
  const check: WebsiteCheck = { at: new Date().toISOString(), searched: false };
  const out: ResolveResult = { check };
  let website = input.website?.trim() || undefined;
  let phone = input.phone;
  let country = marketOf(input.country)?.code;

  // 1. Fill gaps from the full place details (list results can be incomplete).
  const provider = activeProvider();
  if (input.placeId && provider && (!website || !phone)) {
    try {
      const d = await provider.getBusinessDetails(input.placeId);
      if (d) {
        if (!phone && d.phone) out.phone = phone = d.phone;
        if (!country && marketOf(d.country)) out.country = country = marketOf(d.country)!.code;
        if (!input.address && d.address) out.address = d.address;
        if (!website && d.website) { website = d.website; out.website = website; out.websiteSource = provider.id; out.websiteConfidence = "verified"; }
        if (out.phone || out.address || out.website) out.detailsSource = provider.id;
      }
    } catch {}
  }

  // 2. Is the listed link the business's own, current website?
  let listingAudit: WebsiteAudit | undefined;
  let listingStatus: WebsiteStatus = "none";
  if (website) {
    const notOwn = notOwnSite(website);
    if (notOwn) {
      check.listingWebsite = website;
      check.listingIssue = `The website link on the Google listing opens ${notOwn} (${bare(hostOf(website))}), not the business's own site.`;
      website = undefined;
      out.website = undefined;
    } else {
      listingAudit = await analyzeSafe(website, country);
      listingStatus = classifyAudit(listingAudit);
      out.audit = listingAudit;
      // An old http:// or www/non-www address can serve a stale copy while the
      // current site lives on the other variant of the same domain.
      if (listingStatus === "outdated" || listingStatus === "unreachable") {
        let u: URL | null = null;
        try { u = new URL(listingAudit.url); } catch {}
        const isIp = !u || /^[\d.]+$|:/.test(u.hostname);
        const alt = u && (u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`);
        for (const v of isIp || !u ? [] : [`https://${u.host}/`, `https://${alt}${u.port ? `:${u.port}` : ""}/`]) {
          if (v === listingAudit.url || v === listingAudit.finalUrl) continue;
          const a = await analyzeSafe(v, country);
          const st = classifyAudit(a);
          if (RANK[st] > RANK[listingStatus] && st !== "unchecked") {
            check.listingWebsite = website;
            check.listingIssue = `The Google listing links to ${website}, where ${whyOld(listingAudit)}.`;
            check.note = `${bare(new URL(a.finalUrl ?? v).hostname)} loads the business's current site on the same domain.`;
            out.website = website = (a.finalUrl ?? v).replace(/\/$/, "");
            out.websiteSource = "website"; out.websiteConfidence = "detected";
            out.audit = a; listingAudit = a; listingStatus = st;
            break;
          }
        }
      }
    }
  }

  // 3. Look for the current website when there's none, or the listed one is old or broken.
  const needSearch = !website || listingStatus === "outdated" || listingStatus === "unreachable";
  const searcher = input.allowSearch === false ? null : webSearcher();
  if (needSearch && searcher) {
    check.searched = true;
    const q = [input.name, input.city, country && country !== "IN" ? marketOf(country)?.name : undefined].filter(Boolean).join(" ");
    let results: { link: string; title?: string }[] = [];
    try { results = await searcher.search(q, country); }
    catch (e) { if (e instanceof ProviderError && (e.status === 400 || e.status === 429)) throw e; }
    const skip = new Set([website, check.listingWebsite].filter(Boolean).map((w) => bare(hostOf(w!))));
    const seen = new Set<string>();
    const cands = results.filter((r) => {
      const h = bare(hostOf(r.link));
      if (!h || skip.has(h) || seen.has(h) || notOwnSite(r.link)) return false;
      seen.add(h);
      return true;
    }).slice(0, 5);

    const phones = [phone].filter(Boolean) as string[];
    const checked = await Promise.all(cands.map(async (c, rank) => {
      let u: URL;
      try { u = normalizeUrl(c.link); } catch { return null; }
      const page = await fetchPage(u);
      if (!page) return null;
      const id = identify(page, { name: input.name, city: input.city, phones, country });
      if (!id.match) return id.partial ? { c, rank, partial: true as const } : null;
      // Use the site's homepage unless it lives under a path on a shared host.
      const shared = /^(sites\.google\.com|[\w-]+\.wixsite\.com|[\w-]+\.github\.io)$/i.test(page.url.hostname);
      let home = page;
      if (!shared && page.url.pathname !== "/") home = (await fetchPage(new URL("/", page.url))) ?? page;
      const audit = auditOf(home, country);
      return { c, rank, partial: false as const, match: id.match, page: home, audit, status: classifyAudit(audit), shared };
    }));

    const confirmed = checked.filter((x): x is NonNullable<typeof x> & { partial: false } => !!x && !x.partial);
    confirmed.sort((a, b) => (a.match!.kind === b.match!.kind ? 0 : a.match!.kind === "phone" ? -1 : 1) || RANK[b.status] - RANK[a.status] || a.rank - b.rank);
    const best = confirmed[0];
    // Only replace a listed site that loads if the found one is clearly newer.
    const better = best && (!website || listingStatus === "unreachable" || RANK[best.status] > RANK[listingStatus]);
    if (best && better) {
      const url = best.shared ? best.page.url.toString() : best.page.url.origin;
      if (website) {
        check.listingWebsite = check.listingWebsite ?? website;
        check.listingIssue = check.listingIssue ?? `The Google listing links to ${bare(hostOf(website))}, where ${whyOld(listingAudit!)}.`;
      }
      check.note = `Found ${bare(best.page.url.host)} by searching Google for "${q}": ${best.match!.detail}.`;
      out.website = url;
      out.websiteSource = "web_search";
      out.websiteConfidence = best.match!.kind === "phone" ? "detected" : "estimated";
      out.audit = best.audit;
    } else {
      const maybe = checked.filter((x) => x && (x.partial || x !== best)).slice(0, 3);
      if (maybe.length) check.candidates = maybe.map((x) => ({ url: x!.c.link, title: x!.c.title, reason: x!.partial ? "Mentions the business name, but its phone number and city couldn't be confirmed on the page." : "Matches the business, but doesn't look newer than the listed site." }));
      if (!website && !check.listingIssue) check.note = `Searched Google for "${q}"; no site could be confirmed as this business's own.`;
    }
  }
  if (!out.websiteSource) out.website = website;
  return out;
}
