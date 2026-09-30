import type { Technology } from "./types";

// Evidence-based technology detection. Every match cites the exact signal
// (a header, a script URL, a markup marker). Nothing is inferred beyond that.

type Rule = { name: string; category: string; html?: RegExp; url?: RegExp; header?: [string, RegExp]; cookie?: RegExp; version?: RegExp };

const RULES: Rule[] = [
  // Frameworks
  { name: "Next.js", category: "Framework", html: /id="__NEXT_DATA__"|\/_next\/static\//, header: ["x-powered-by", /next\.js/i] },
  { name: "Nuxt", category: "Framework", html: /window\.__NUXT__|\/_nuxt\// },
  { name: "Gatsby", category: "Framework", html: /id="___gatsby"/ },
  { name: "React", category: "Framework", html: /data-reactroot|id="__NEXT_DATA__"|\/_next\/static\/|react-dom(\.production)?(\.min)?\.js/ },
  { name: "Vue.js", category: "Framework", html: /\sdata-v-[0-9a-f]{6,8}(=|\s|>)|vue(\.runtime)?(\.global)?(\.prod)?(\.min)?\.js/ },
  { name: "Angular", category: "Framework", html: /\sng-version="/, version: /ng-version="([\d.]+)"/ },
  { name: "Svelte", category: "Framework", html: /class="[^"]*\bsvelte-[a-z0-9]{5,8}\b/ },
  { name: "Astro", category: "Framework", html: /<astro-island|name="generator" content="Astro/ },
  // CMS / site builders
  { name: "WordPress", category: "CMS", html: /\/wp-content\/|\/wp-includes\//, version: /name="generator" content="WordPress ([\d.]+)"/ },
  { name: "WooCommerce", category: "E-commerce", html: /woocommerce(-page|-cart|_params)|\/plugins\/woocommerce\// },
  { name: "Elementor", category: "Page builder", html: /elementor-(kit|element|widget)|\/plugins\/elementor\// },
  { name: "Divi", category: "Page builder", html: /et_pb_|\/themes\/Divi\// },
  { name: "Shopify", category: "E-commerce", html: /cdn\.shopify\.com|Shopify\.theme/, header: ["x-shopid", /./] },
  { name: "Wix", category: "Site builder", html: /static\.wixstatic\.com|wix-bolt|_wixCssImports/, header: ["x-wix-request-id", /./] },
  { name: "Squarespace", category: "Site builder", html: /static1\.squarespace\.com|Squarespace\.Constants/ },
  { name: "Webflow", category: "Site builder", html: /data-wf-page=|webflow\.js|assets\.website-files\.com|cdn\.prod\.website-files\.com/ },
  { name: "Framer", category: "Site builder", html: /framerusercontent\.com|name="generator" content="Framer/ },
  { name: "Joomla", category: "CMS", html: /name="generator" content="Joomla|\/media\/jui\// },
  { name: "Drupal", category: "CMS", html: /Drupal\.settings|name="generator" content="Drupal|\/sites\/default\/files\//, header: ["x-generator", /drupal/i] },
  { name: "Magento", category: "E-commerce", html: /Magento_|mage\/cookies|\/static\/version\d+\/frontend\// },
  { name: "BigCommerce", category: "E-commerce", html: /cdn\d*\.bigcommerce\.com/ },
  { name: "Ghost", category: "CMS", html: /name="generator" content="Ghost/ },
  { name: "Blogger", category: "CMS", html: /blogger\.com\/static|name="generator" content="blogger/i },
  { name: "GoDaddy Website Builder", category: "Site builder", html: /img1\.wsimg\.com|name="generator" content="Starfield/ },
  { name: "Zoho Sites", category: "Site builder", html: /zohositescontent|static\.zohocdn\.com\/sites/ },
  { name: "Hostinger Website Builder", category: "Site builder", html: /zyrosite\.com|userapp\.zyrosite/ },
  // Server / language
  { name: "PHP", category: "Language", header: ["x-powered-by", /php/i], cookie: /PHPSESSID/, version: /PHP\/([\d.]+)/i },
  { name: "ASP.NET", category: "Framework", header: ["x-aspnet-version", /./], html: /id="__VIEWSTATE"/ },
  { name: "Express (Node.js)", category: "Framework", header: ["x-powered-by", /express/i] },
  { name: "Nginx", category: "Web server", header: ["server", /nginx/i], version: /nginx\/([\d.]+)/i },
  { name: "Apache", category: "Web server", header: ["server", /apache/i], version: /Apache\/([\d.]+)/i },
  { name: "LiteSpeed", category: "Web server", header: ["server", /litespeed/i] },
  { name: "Microsoft IIS", category: "Web server", header: ["server", /iis/i], version: /IIS\/([\d.]+)/i },
  // Hosting / CDN
  { name: "Cloudflare", category: "CDN", header: ["cf-ray", /./] },
  { name: "Vercel", category: "Hosting", header: ["x-vercel-id", /./] },
  { name: "Netlify", category: "Hosting", header: ["x-nf-request-id", /./] },
  { name: "Amazon CloudFront", category: "CDN", header: ["x-amz-cf-id", /./] },
  { name: "Fastly", category: "CDN", header: ["x-served-by", /cache-/i] },
  { name: "Akamai", category: "CDN", header: ["server", /akamai/i] },
  { name: "GitHub Pages", category: "Hosting", header: ["server", /github\.com/i] },
  { name: "Firebase Hosting", category: "Hosting", header: ["x-firebase-hosting", /./] },
  // Analytics & tags
  { name: "Google Analytics 4", category: "Analytics", url: /googletagmanager\.com\/gtag\/js\?id=G-|google-analytics\.com\/g\/collect/, html: /gtag\(['"]config['"],\s*['"]G-/ },
  { name: "Universal Analytics (retired)", category: "Analytics", url: /google-analytics\.com\/analytics\.js|gtag\/js\?id=UA-/, html: /['"]UA-\d{4,}-\d+['"]/ },
  { name: "Google Tag Manager", category: "Tag manager", url: /googletagmanager\.com\/gtm\.js/, html: /GTM-[A-Z0-9]{4,}/ },
  { name: "Google Ads", category: "Advertising", url: /googleadservices\.com|googlesyndication\.com|gtag\/js\?id=AW-/, html: /['"]AW-\d{6,}['"]/ },
  { name: "Meta Pixel", category: "Advertising", url: /connect\.facebook\.net\/[^"']*fbevents\.js/, html: /fbq\(['"]init['"]/ },
  { name: "LinkedIn Insight", category: "Advertising", url: /snap\.licdn\.com/ },
  { name: "Hotjar", category: "Analytics", url: /static\.hotjar\.com/ },
  { name: "Microsoft Clarity", category: "Analytics", url: /clarity\.ms\/tag/ },
  { name: "Matomo", category: "Analytics", url: /matomo\.js|piwik\.js/ },
  { name: "Plausible", category: "Analytics", url: /plausible\.io\/js/ },
  { name: "Mixpanel", category: "Analytics", url: /cdn\.mxpnl\.com|mixpanel/ },
  { name: "Segment", category: "Analytics", url: /cdn\.segment\.com/ },
  // Payments
  { name: "Razorpay", category: "Payments", url: /checkout\.razorpay\.com/ },
  { name: "Stripe", category: "Payments", url: /js\.stripe\.com/ },
  { name: "PayPal", category: "Payments", url: /paypal\.com\/sdk|paypalobjects\.com/ },
  { name: "Cashfree", category: "Payments", url: /cashfree\.com/ },
  { name: "PayU", category: "Payments", url: /payu\.in|payumoney/ },
  { name: "Instamojo", category: "Payments", url: /instamojo\.com/ },
  // Chat / support
  { name: "Tawk.to", category: "Chat", url: /embed\.tawk\.to/ },
  { name: "Intercom", category: "Chat", url: /widget\.intercom\.io|js\.intercomcdn\.com/ },
  { name: "Crisp", category: "Chat", url: /client\.crisp\.chat/ },
  { name: "Zendesk Chat", category: "Chat", url: /static\.zdassets\.com|zopim/ },
  { name: "Freshchat", category: "Chat", url: /wchat\.freshchat\.com|freshworks/ },
  { name: "Tidio", category: "Chat", url: /code\.tidio\.co/ },
  { name: "Drift", category: "Chat", url: /js\.driftt\.com/ },
  { name: "WATI", category: "WhatsApp", url: /wati\.io/ },
  { name: "Interakt", category: "WhatsApp", url: /interakt/ },
  { name: "Gallabox", category: "WhatsApp", url: /gallabox/ },
  { name: "AiSensy", category: "WhatsApp", url: /aisensy/ },
  { name: "Chatbase", category: "AI chat", url: /chatbase\.co/ },
  { name: "Botpress", category: "AI chat", url: /botpress/ },
  // CRM / marketing / forms
  { name: "HubSpot", category: "CRM / marketing", url: /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/ },
  { name: "Zoho SalesIQ", category: "CRM / marketing", url: /salesiq\.zoho/ },
  { name: "Mailchimp", category: "Email marketing", url: /list-manage\.com|chimpstatic\.com/ },
  { name: "Klaviyo", category: "Email marketing", url: /klaviyo\.com/ },
  { name: "Brevo", category: "Email marketing", url: /sibforms\.com|sendinblue/ },
  { name: "Calendly", category: "Booking", url: /assets\.calendly\.com|calendly\.com\// },
  { name: "Typeform", category: "Forms", url: /embed\.typeform\.com|typeform\.com\/to\// },
  { name: "Google Forms", category: "Forms", url: /docs\.google\.com\/forms/ },
  { name: "Google reCAPTCHA", category: "Spam protection", url: /google\.com\/recaptcha|recaptcha\/api\.js|gstatic\.com\/recaptcha/ },
  { name: "hCaptcha", category: "Spam protection", url: /hcaptcha\.com/ },
  { name: "Cloudflare Turnstile", category: "Spam protection", url: /challenges\.cloudflare\.com\/turnstile/ },
  // Fonts & libraries
  { name: "Google Fonts", category: "Fonts", url: /fonts\.googleapis\.com|fonts\.gstatic\.com/ },
  { name: "Adobe Fonts", category: "Fonts", url: /use\.typekit\.net/ },
  { name: "Font Awesome", category: "Icons", url: /font-?awesome|kit\.fontawesome\.com/ },
  { name: "jQuery", category: "JavaScript library", url: /jquery[.-]?(\d[\d.]*)?(\.min)?\.js/, version: /jquery[.-](\d+\.\d+(?:\.\d+)?)/i },
  { name: "Bootstrap", category: "UI framework", url: /bootstrap(\.bundle)?(\.min)?\.(js|css)/, version: /bootstrap[@/-]?(\d+\.\d+(?:\.\d+)?)/i },
  { name: "GSAP", category: "Animation", url: /gsap(\.min)?\.js|greensock/ },
  { name: "Three.js", category: "3D", url: /three(\.module)?(\.min)?\.js/ },
  { name: "Swiper", category: "JavaScript library", url: /swiper(-bundle)?(\.min)?\.(js|css)/ },
  { name: "Slick carousel", category: "JavaScript library", url: /slick(\.min)?\.js/ },
  { name: "AOS", category: "Animation", url: /\baos(\.min)?\.js/ },
  { name: "Lottie", category: "Animation", url: /lottie(-player)?(\.min)?\.js/ },
  { name: "YouTube embed", category: "Media", url: /youtube\.com\/embed|youtube-nocookie\.com\/embed/ },
  { name: "Google Maps embed", category: "Maps", url: /google\.com\/maps\/embed|maps\.googleapis\.com\/maps\/api\/js/ },
];

export interface TechInput { html?: string; urls?: string[]; headers?: Record<string, string>; cookies?: string[] }

const short = (s: string) => (s.length > 90 ? `${s.slice(0, 87)}…` : s);

export function detectTech(input: TechInput): Technology[] {
  const out = new Map<string, Technology>();
  const headers = Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const urls = input.urls ?? [];
  for (const r of RULES) {
    let evidence: string | undefined;
    let versionSrc = "";
    if (r.header && headers[r.header[0]] !== undefined && r.header[1].test(headers[r.header[0]])) {
      evidence = `Response header ${r.header[0]}: ${short(headers[r.header[0]])}`;
      versionSrc = headers[r.header[0]];
    }
    if (!evidence && r.url) {
      const hit = urls.find((u) => r.url!.test(u));
      if (hit) { evidence = `Loads ${short(hit)}`; versionSrc = hit; }
    }
    if (!evidence && r.html && input.html) {
      const m = input.html.match(r.html);
      if (m) { evidence = `Page markup contains "${short(m[0])}"`; versionSrc = input.html.slice(Math.max(0, (m.index ?? 0) - 200), (m.index ?? 0) + 400); }
    }
    if (!evidence && r.cookie && input.cookies?.some((c) => r.cookie!.test(c))) evidence = "Sets a matching cookie";
    if (!evidence) continue;
    const version = r.version ? (versionSrc.match(r.version)?.[1] ?? input.html?.match(r.version)?.[1]) : undefined;
    out.set(r.name, { name: r.name, category: r.category, evidence, version });
  }
  return [...out.values()];
}

export function mergeTech(lists: Technology[][]): Technology[] {
  const m = new Map<string, Technology>();
  for (const l of lists) for (const t of l) if (!m.has(t.name) || (!m.get(t.name)!.version && t.version)) m.set(t.name, t);
  return [...m.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

// What a third-party script host is for, when the host is well known.
export function scriptPurpose(url: string): string | undefined {
  const t = detectTech({ urls: [url] })[0];
  return t ? `${t.name} (${t.category})` : undefined;
}
