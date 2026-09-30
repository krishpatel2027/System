// URL helpers shared by the crawler (server) and the orchestrator (browser).

export function sameSite(a: URL, b: URL) {
  return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");
}

// Canonical form used to dedupe crawl URLs.
export function crawlKey(u: URL) {
  const x = new URL(u.toString());
  x.hash = "";
  x.hostname = x.hostname.replace(/^www\./, "");
  for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|mc_)/i.test(k)) x.searchParams.delete(k);
  let p = x.pathname.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  x.pathname = p;
  return `${x.protocol}//${x.host}${x.pathname}${x.search}`.toLowerCase();
}

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|mp4|webm|mov|mp3|wav|zip|rar|7z|gz|docx?|xlsx?|pptx?|csv|xml|json|txt|css|js|woff2?|ttf|eot|apk|exe|dmg)$/i;

export const crawlable = (u: URL) =>
  /^https?:$/.test(u.protocol) &&
  !SKIP_EXT.test(u.pathname) &&
  !/\/(wp-admin|wp-login|cart|checkout|my-account|account|login|signin|signup|register|logout|cdn-cgi|feed)\b/i.test(u.pathname) &&
  !/[?&](add-to-cart|replytocom|s=|search=|orderby=|filter_)/i.test(u.search);

// Pages worth reading first when the crawl budget is limited.
export function importance(u: URL, depth: number, fromSitemap: boolean) {
  const p = u.pathname.toLowerCase();
  let s = 100 - depth * 15 - (fromSitemap ? 10 : 0) - Math.min(20, p.split("/").length * 3);
  if (/\/(contact|about|services?|pricing|plans|products?|shop|store|portfolio|projects?|work|case-stud|faq|menu|book|appointment|treatments?|courses?|rooms|propert|locations?|team|reviews|testimonials)/.test(p)) s += 40;
  if (/\/(blog|news|articles?|posts?)\/?$/.test(p)) s += 15;
  if (/\/(tag|category|author|page)\/|\/\d{4}\/\d{2}\//.test(p)) s -= 40;
  if (u.search) s -= 25;
  return s;
}
