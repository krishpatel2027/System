export interface CalcFeature { category: string; feature: string; unit: string; entry: number; standard: number; premium: number; notes: string }
export interface CalcPackage { name: string; price: number; scope: string; bestFor: string; included: string; positioning: string }
export interface Rate { role: string; rate: number; low: number; high: number }
export interface CarePlan { name: string; monthly: number; hours: number; desc: string; bestFor: string }
export interface Policy { policy: string; standard: string; details: string; client: string }

export const FEATURES: CalcFeature[] = [{"category":"Website","feature":"Landing page","unit":"page","entry":8000,"standard":15000,"premium":25000,"notes":"High-conversion/custom page"},{"category":"Website","feature":"Standard page","unit":"page","entry":2500,"standard":4000,"premium":7000,"notes":"About, services, contact etc."},{"category":"Website","feature":"Complex page","unit":"page","entry":5000,"standard":8000,"premium":15000,"notes":"Interactive/content-heavy"},{"category":"Website","feature":"Product/service page","unit":"page","entry":3500,"standard":6000,"premium":9000,"notes":"Reusable template"},{"category":"Website","feature":"Blog/CMS template","unit":"template","entry":4000,"standard":7000,"premium":10000,"notes":"CMS listing + detail"},{"category":"Website","feature":"Portfolio/case-study template","unit":"template","entry":4000,"standard":7000,"premium":10000,"notes":"Reusable case study"},{"category":"Website","feature":"Property listing template","unit":"template","entry":6000,"standard":10000,"premium":15000,"notes":"Real-estate focused"},{"category":"Website","feature":"Responsive implementation","unit":"project","entry":3000,"standard":6000,"premium":10000,"notes":"If not included in base"},{"category":"Website","feature":"Dark/light mode","unit":"project","entry":2000,"standard":4000,"premium":7000,"notes":"Theme system"},{"category":"Website","feature":"Accessibility pass","unit":"project","entry":2000,"standard":5000,"premium":8000,"notes":"Basic WCAG-oriented pass"},{"category":"Forms","feature":"Basic contact form","unit":"form","entry":500,"standard":1000,"premium":2000,"notes":"Email notification"},{"category":"Forms","feature":"Multi-field lead form","unit":"form","entry":1500,"standard":2500,"premium":4000,"notes":"Validation + notifications"},{"category":"Forms","feature":"Multi-step form","unit":"form","entry":3000,"standard":5000,"premium":8000,"notes":"Conditional steps"},{"category":"Forms","feature":"File upload form","unit":"form","entry":2000,"standard":4000,"premium":7000,"notes":"Secure upload flow"},{"category":"Forms","feature":"Quote/calculator form","unit":"form","entry":4000,"standard":8000,"premium":12000,"notes":"Logic + results"},{"category":"Forms","feature":"CRM integration","unit":"integration","entry":5000,"standard":8000,"premium":15000,"notes":"HubSpot/Zoho/etc."},{"category":"Forms","feature":"Email automation","unit":"flow","entry":3000,"standard":6000,"premium":10000,"notes":"Transactional/workflow email"},{"category":"Integrations","feature":"WhatsApp button","unit":"integration","entry":500,"standard":1000,"premium":2000,"notes":"Click-to-chat"},{"category":"Integrations","feature":"WhatsApp lead integration","unit":"integration","entry":2000,"standard":5000,"premium":10000,"notes":"Structured lead flow"},{"category":"Integrations","feature":"Google Maps","unit":"integration","entry":500,"standard":1000,"premium":2000,"notes":"Embed/basic API"},{"category":"Integrations","feature":"Analytics setup","unit":"project","entry":1000,"standard":2000,"premium":4000,"notes":"GA4/analytics"},{"category":"Integrations","feature":"Search Console","unit":"project","entry":500,"standard":1500,"premium":2500,"notes":"Verification/setup"},{"category":"Integrations","feature":"Social feeds","unit":"integration","entry":1500,"standard":3000,"premium":5000,"notes":"Instagram/social feed"},{"category":"Integrations","feature":"Calendar integration","unit":"integration","entry":2000,"standard":5000,"premium":8000,"notes":"Calendly/custom"},{"category":"Integrations","feature":"Email marketing integration","unit":"integration","entry":2000,"standard":5000,"premium":9000,"notes":"Mailchimp/etc."},{"category":"CMS","feature":"Basic CMS","unit":"project","entry":3000,"standard":5000,"premium":8000,"notes":"Content editing"},{"category":"CMS","feature":"Blog CMS","unit":"project","entry":5000,"standard":8000,"premium":12000,"notes":"Posts/categories"},{"category":"CMS","feature":"Advanced CMS","unit":"project","entry":10000,"standard":15000,"premium":25000,"notes":"Multiple content types"},{"category":"CMS","feature":"Media library","unit":"project","entry":3000,"standard":6000,"premium":10000,"notes":"Managed media"},{"category":"CMS","feature":"Role-based CMS","unit":"project","entry":5000,"standard":10000,"premium":18000,"notes":"Editor/admin roles"},{"category":"CMS","feature":"Headless CMS integration","unit":"integration","entry":7000,"standard":12000,"premium":20000,"notes":"Sanity/Strapi/etc."},{"category":"Booking","feature":"Basic booking","unit":"feature","entry":8000,"standard":12000,"premium":20000,"notes":"Availability + booking"},{"category":"Booking","feature":"Advanced booking","unit":"feature","entry":15000,"standard":25000,"premium":40000,"notes":"Rules, staff, slots"},{"category":"Booking","feature":"Appointment reminders","unit":"feature","entry":3000,"standard":6000,"premium":10000,"notes":"Email/SMS/WhatsApp"},{"category":"E-commerce","feature":"Shopify setup","unit":"project","entry":10000,"standard":20000,"premium":35000,"notes":"Theme/configuration"},{"category":"E-commerce","feature":"WooCommerce setup","unit":"project","entry":10000,"standard":20000,"premium":35000,"notes":"Store setup"},{"category":"E-commerce","feature":"Product catalog","unit":"feature","entry":5000,"standard":10000,"premium":18000,"notes":"Catalog structure"},{"category":"E-commerce","feature":"Product filters","unit":"feature","entry":4000,"standard":8000,"premium":15000,"notes":"Search/filter UX"},{"category":"E-commerce","feature":"Cart","unit":"feature","entry":5000,"standard":8000,"premium":12000,"notes":"Custom cart UI"},{"category":"E-commerce","feature":"Checkout","unit":"feature","entry":7000,"standard":12000,"premium":20000,"notes":"Checkout customization"},{"category":"E-commerce","feature":"Payment gateway","unit":"integration","entry":5000,"standard":8000,"premium":15000,"notes":"Razorpay/Stripe/etc."},{"category":"E-commerce","feature":"Coupons/discounts","unit":"feature","entry":3000,"standard":6000,"premium":10000,"notes":"Rules"},{"category":"E-commerce","feature":"Shipping integration","unit":"integration","entry":5000,"standard":10000,"premium":18000,"notes":"Rates/tracking"},{"category":"E-commerce","feature":"GST/tax setup","unit":"feature","entry":3000,"standard":6000,"premium":10000,"notes":"Tax configuration"},{"category":"E-commerce","feature":"Inventory management","unit":"feature","entry":5000,"standard":10000,"premium":20000,"notes":"Stock logic"},{"category":"E-commerce","feature":"Wishlist","unit":"feature","entry":3000,"standard":5000,"premium":9000,"notes":"Saved products"},{"category":"E-commerce","feature":"Reviews","unit":"feature","entry":2000,"standard":4000,"premium":7000,"notes":"Product reviews"},{"category":"E-commerce","feature":"Subscriptions","unit":"feature","entry":8000,"standard":15000,"premium":25000,"notes":"Recurring billing"},{"category":"E-commerce","feature":"Marketplace functionality","unit":"feature","entry":30000,"standard":60000,"premium":120000,"notes":"Multi-vendor"},{"category":"Design","feature":"Discovery/workshop","unit":"project","entry":3000,"standard":7000,"premium":12000,"notes":"Requirements + direction"},{"category":"Design","feature":"Wireframes","unit":"screen","entry":3000,"standard":6000,"premium":10000,"notes":"Low/mid fidelity"},{"category":"Design","feature":"UI/UX design","unit":"screen","entry":5000,"standard":9000,"premium":15000,"notes":"Custom screen"},{"category":"Design","feature":"Design system","unit":"project","entry":5000,"standard":10000,"premium":20000,"notes":"Tokens/components"},{"category":"Design","feature":"Prototype","unit":"project","entry":3000,"standard":7000,"premium":12000,"notes":"Interactive prototype"},{"category":"Design","feature":"Brand direction","unit":"project","entry":5000,"standard":10000,"premium":20000,"notes":"Visual direction"},{"category":"Design","feature":"Custom icon set","unit":"set","entry":3000,"standard":7000,"premium":15000,"notes":"Custom icons"},{"category":"Design","feature":"Illustration","unit":"asset","entry":3000,"standard":7000,"premium":15000,"notes":"Per illustration"},{"category":"Design","feature":"3D asset","unit":"asset","entry":5000,"standard":10000,"premium":30000,"notes":"Model/scene"},{"category":"Motion","feature":"Micro interactions","unit":"project","entry":2000,"standard":4000,"premium":7000,"notes":"Hover/button/transitions"},{"category":"Motion","feature":"Reveal animations","unit":"section","entry":1000,"standard":2500,"premium":5000,"notes":"Fade/clip/text"},{"category":"Motion","feature":"Scroll animations","unit":"section","entry":2000,"standard":4000,"premium":8000,"notes":"Scroll-triggered"},{"category":"Motion","feature":"Parallax","unit":"section","entry":2000,"standard":4000,"premium":7000,"notes":"Depth motion"},{"category":"Motion","feature":"Marquee","unit":"section","entry":1000,"standard":2500,"premium":5000,"notes":"Infinite motion"},{"category":"Motion","feature":"Animated cards","unit":"section","entry":2000,"standard":4000,"premium":8000,"notes":"Hover/scroll"},{"category":"Motion","feature":"Kinetic typography","unit":"section","entry":3000,"standard":6000,"premium":10000,"notes":"Text motion"},{"category":"Motion","feature":"GSAP timeline","unit":"interaction","entry":4000,"standard":8000,"premium":15000,"notes":"Custom timeline"},{"category":"Motion","feature":"Pinned scrolling","unit":"section","entry":5000,"standard":10000,"premium":18000,"notes":"ScrollTrigger"},{"category":"Motion","feature":"Horizontal scrolling","unit":"section","entry":5000,"standard":10000,"premium":18000,"notes":"Horizontal scene"},{"category":"Motion","feature":"Page transitions","unit":"project","entry":5000,"standard":10000,"premium":18000,"notes":"Route transitions"},{"category":"Motion","feature":"FLIP transitions","unit":"interaction","entry":4000,"standard":8000,"premium":15000,"notes":"State transitions"},{"category":"Motion","feature":"Magnetic cursor","unit":"project","entry":3000,"standard":6000,"premium":10000,"notes":"Cursor interaction"},{"category":"Motion","feature":"Image distortion","unit":"section","entry":5000,"standard":10000,"premium":20000,"notes":"Shader/distortion"},{"category":"Motion","feature":"3D gallery/cylinder","unit":"section","entry":8000,"standard":15000,"premium":30000,"notes":"Interactive gallery"},{"category":"Motion","feature":"Ken Burns","unit":"section","entry":1000,"standard":2500,"premium":5000,"notes":"Cinematic image motion"},{"category":"3D/WebGL","feature":"Three.js scene","unit":"scene","entry":10000,"standard":20000,"premium":40000,"notes":"Custom 3D scene"},{"category":"3D/WebGL","feature":"WebGL experience","unit":"scene","entry":20000,"standard":40000,"premium":80000,"notes":"Advanced interactive"},{"category":"3D/WebGL","feature":"Shader effect","unit":"effect","entry":8000,"standard":15000,"premium":30000,"notes":"Custom shader"},{"category":"3D/WebGL","feature":"3D product configurator","unit":"feature","entry":20000,"standard":40000,"premium":80000,"notes":"Interactive model"},{"category":"Web App","feature":"Authentication","unit":"module","entry":8000,"standard":15000,"premium":25000,"notes":"Email/password"},{"category":"Web App","feature":"OTP login","unit":"module","entry":5000,"standard":10000,"premium":18000,"notes":"SMS OTP"},{"category":"Web App","feature":"Social login","unit":"integration","entry":3000,"standard":6000,"premium":10000,"notes":"Google etc."},{"category":"Web App","feature":"User roles","unit":"module","entry":5000,"standard":10000,"premium":18000,"notes":"RBAC"},{"category":"Web App","feature":"Permissions","unit":"module","entry":5000,"standard":10000,"premium":20000,"notes":"Fine-grained"},{"category":"Web App","feature":"Admin dashboard","unit":"module","entry":15000,"standard":25000,"premium":40000,"notes":"Custom dashboard"},{"category":"Web App","feature":"User dashboard","unit":"module","entry":12000,"standard":20000,"premium":35000,"notes":"Account area"},{"category":"Web App","feature":"Analytics dashboard","unit":"module","entry":10000,"standard":20000,"premium":35000,"notes":"Charts/reporting"},{"category":"Web App","feature":"Reports","unit":"module","entry":8000,"standard":15000,"premium":25000,"notes":"PDF/CSV etc."},{"category":"Web App","feature":"API integration","unit":"integration","entry":5000,"standard":10000,"premium":25000,"notes":"Per system"},{"category":"Web App","feature":"Custom API","unit":"module","entry":15000,"standard":30000,"premium":60000,"notes":"Backend API"},{"category":"Web App","feature":"Database design","unit":"project","entry":8000,"standard":15000,"premium":30000,"notes":"Schema + setup"},{"category":"Web App","feature":"File storage","unit":"module","entry":5000,"standard":10000,"premium":20000,"notes":"S3/etc."},{"category":"Web App","feature":"Advanced search","unit":"module","entry":10000,"standard":20000,"premium":40000,"notes":"Indexing/filtering"},{"category":"Web App","feature":"Webhooks","unit":"integration","entry":5000,"standard":10000,"premium":20000,"notes":"Event integration"},{"category":"Web App","feature":"Realtime functionality","unit":"module","entry":15000,"standard":30000,"premium":60000,"notes":"Sockets/realtime"},{"category":"Web App","feature":"Notifications","unit":"module","entry":5000,"standard":10000,"premium":20000,"notes":"Email/in-app"},{"category":"Mobile","feature":"React Native/Flutter app shell","unit":"project","entry":15000,"standard":30000,"premium":50000,"notes":"App foundation"},{"category":"Mobile","feature":"Push notifications","unit":"feature","entry":5000,"standard":10000,"premium":18000,"notes":"FCM/APNs"},{"category":"Mobile","feature":"Deep links","unit":"feature","entry":3000,"standard":6000,"premium":10000,"notes":"Universal links"},{"category":"Mobile","feature":"Offline mode","unit":"feature","entry":8000,"standard":15000,"premium":30000,"notes":"Offline data"},{"category":"Mobile","feature":"Camera","unit":"feature","entry":5000,"standard":10000,"premium":20000,"notes":"Capture"},{"category":"Mobile","feature":"GPS/location","unit":"feature","entry":5000,"standard":10000,"premium":20000,"notes":"Location"},{"category":"Mobile","feature":"Maps","unit":"feature","entry":5000,"standard":10000,"premium":20000,"notes":"Maps UI"},{"category":"Mobile","feature":"QR scanner","unit":"feature","entry":4000,"standard":8000,"premium":15000,"notes":"Scan flow"},{"category":"Mobile","feature":"Chat","unit":"feature","entry":10000,"standard":20000,"premium":40000,"notes":"Messaging"},{"category":"Mobile","feature":"Realtime mobile","unit":"feature","entry":15000,"standard":30000,"premium":60000,"notes":"Realtime sync"},{"category":"Mobile","feature":"App Store deployment","unit":"deployment","entry":3000,"standard":6000,"premium":10000,"notes":"Submission support"},{"category":"Mobile","feature":"Play Store deployment","unit":"deployment","entry":3000,"standard":6000,"premium":10000,"notes":"Submission support"},{"category":"AI","feature":"AI chatbot","unit":"feature","entry":10000,"standard":20000,"premium":40000,"notes":"LLM chatbot"},{"category":"AI","feature":"LLM integration","unit":"integration","entry":10000,"standard":20000,"premium":50000,"notes":"API + UI"},{"category":"AI","feature":"RAG knowledge base","unit":"feature","entry":20000,"standard":40000,"premium":80000,"notes":"Docs + retrieval"},{"category":"AI","feature":"AI agent","unit":"feature","entry":25000,"standard":50000,"premium":100000,"notes":"Tool-using agent"},{"category":"AI","feature":"OCR/document processing","unit":"feature","entry":10000,"standard":25000,"premium":50000,"notes":"Extraction"},{"category":"AI","feature":"Recommendation system","unit":"feature","entry":15000,"standard":30000,"premium":60000,"notes":"Rules/ML/LLM"},{"category":"AI","feature":"Image classification","unit":"feature","entry":15000,"standard":30000,"premium":60000,"notes":"Vision model"},{"category":"AI","feature":"AI monitoring/evaluation","unit":"project","entry":10000,"standard":20000,"premium":40000,"notes":"Quality/cost monitoring"},{"category":"SEO","feature":"SEO foundation","unit":"project","entry":3000,"standard":5000,"premium":8000,"notes":"Metadata/sitemap/schema basics"},{"category":"SEO","feature":"On-page SEO","unit":"page","entry":1000,"standard":2000,"premium":4000,"notes":"Per page"},{"category":"SEO","feature":"Technical SEO audit","unit":"project","entry":3000,"standard":7000,"premium":12000,"notes":"Technical fixes"},{"category":"SEO","feature":"Schema markup","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Structured data"},{"category":"SEO","feature":"Local SEO setup","unit":"project","entry":3000,"standard":7000,"premium":12000,"notes":"Google Business etc."},{"category":"SEO","feature":"Performance optimization","unit":"project","entry":3000,"standard":7000,"premium":15000,"notes":"Core Web Vitals"},{"category":"SEO","feature":"Image optimization","unit":"project","entry":1500,"standard":3000,"premium":6000,"notes":"Compression/formats"},{"category":"Infrastructure","feature":"Hosting setup","unit":"project","entry":1000,"standard":2500,"premium":5000,"notes":"Deployment config"},{"category":"Infrastructure","feature":"CDN setup","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Cloud/CDN"},{"category":"Infrastructure","feature":"Security hardening","unit":"project","entry":3000,"standard":7000,"premium":15000,"notes":"Headers/access"},{"category":"Infrastructure","feature":"CI/CD","unit":"project","entry":5000,"standard":10000,"premium":20000,"notes":"Automated deploy"},{"category":"Infrastructure","feature":"Staging environment","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Preview/staging"},{"category":"Infrastructure","feature":"Monitoring","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Uptime/errors"},{"category":"Infrastructure","feature":"Backups","unit":"project","entry":1500,"standard":3000,"premium":6000,"notes":"Backup automation"},{"category":"Infrastructure","feature":"Database backup","unit":"project","entry":2000,"standard":4000,"premium":8000,"notes":"Managed DB"},{"category":"Infrastructure","feature":"Performance monitoring","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Vitals/metrics"},{"category":"Content","feature":"Copywriting","unit":"project","entry":3000,"standard":8000,"premium":15000,"notes":"Small website"},{"category":"Content","feature":"Image sourcing","unit":"project","entry":2000,"standard":4000,"premium":7000,"notes":"Licensed/source assets"},{"category":"Content","feature":"Image editing","unit":"asset","entry":1000,"standard":2500,"premium":5000,"notes":"Per batch"},{"category":"Content","feature":"Video editing","unit":"project","entry":3000,"standard":8000,"premium":20000,"notes":"Short-form/site video"},{"category":"Content","feature":"Custom graphics","unit":"asset","entry":3000,"standard":7000,"premium":15000,"notes":"Per batch"},{"category":"Content","feature":"3D content production","unit":"project","entry":10000,"standard":20000,"premium":40000,"notes":"Scene/assets"},{"category":"Management","feature":"Project management","unit":"project","entry":3000,"standard":7000,"premium":15000,"notes":"Coordination"},{"category":"Management","feature":"Technical documentation","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Handover docs"},{"category":"Management","feature":"Client training","unit":"session","entry":1500,"standard":3000,"premium":6000,"notes":"CMS/admin training"},{"category":"Management","feature":"Post-launch support","unit":"project","entry":2000,"standard":5000,"premium":10000,"notes":"Initial support"},{"category":"Management","feature":"Migration","unit":"project","entry":5000,"standard":10000,"premium":25000,"notes":"Content/site migration"},{"category":"Management","feature":"Data entry","unit":"hour","entry":400,"standard":700,"premium":1200,"notes":"Per hour"}];

export const CALC_PACKAGES: CalcPackage[] = [{"name":"Basic","price":7500,"scope":"Up to 3 pages","bestFor":"Local businesses / individuals","included":"Custom responsive UI, basic motion, form, WhatsApp, basic SEO, deployment","positioning":"Entry"},{"name":"Business","price":15000,"scope":"5–7 pages","bestFor":"SMBs / service businesses","included":"Custom UI/UX, stronger motion, lead system, WhatsApp, basic CMS, SEO, analytics, deployment","positioning":"Core"},{"name":"Pro","price":30000,"scope":"7–10 pages","bestFor":"Growing businesses / startups","included":"Premium UI, advanced interactions, CMS, lead management, advanced forms, SEO, performance, analytics","positioning":"Premium"},{"name":"Experience","price":55000,"scope":"Bespoke scope","bestFor":"Brands wanting standout sites","included":"GSAP, advanced scroll interactions, selective 3D, custom components, CMS/API integrations, performance","positioning":"High-end"},{"name":"Custom","price":100000,"scope":"Requirement based","bestFor":"Complex websites / portals / apps","included":"Scope-based estimate","positioning":"Custom"}];

export const HOURLY: Rate[] = [{"role":"UI/UX","rate":650,"low":500,"high":800},{"role":"Frontend","rate":800,"low":600,"high":1000},{"role":"Backend","rate":900,"low":700,"high":1200},{"role":"Animation","rate":1000,"low":700,"high":1500},{"role":"Mobile","rate":900,"low":700,"high":1200},{"role":"AI","rate":1500,"low":1000,"high":2000},{"role":"QA","rate":550,"low":400,"high":700},{"role":"Project management","rate":700,"low":500,"high":1000},{"role":"DevOps","rate":1200,"low":800,"high":1800},{"role":"Creative direction","rate":1000,"low":700,"high":1500}];

// Single source of truth for maintenance/care plans — also used by /maintenance
// and referenced by plan name in seeded subscriptions. Do not duplicate elsewhere.
export const MAINT_PLANS: CarePlan[] = [
  { name: "BASIC", monthly: 2500, hours: 2, desc: "Backups, updates, minor fixes, basic monitoring", bestFor: "Small sites" },
  { name: "STANDARD", monthly: 5000, hours: 5, desc: "Updates, monitoring, content edits, minor improvements", bestFor: "Active SMB sites" },
  { name: "GROWTH", monthly: 9000, hours: 10, desc: "Maintenance, SEO, performance, content, improvements", bestFor: "Growth-focused businesses" },
  { name: "PRO", monthly: 15000, hours: 20, desc: "Priority support, continuous improvements, dev hours", bestFor: "Businesses needing ongoing dev" },
  { name: "DEDICATED", monthly: 25000, hours: 40, desc: "Dedicated capacity, priority support, continuous dev", bestFor: "Long-term clients" },
];
export const CARE = MAINT_PLANS;

export const POLICIES: Policy[] = [{"policy":"Payment under ₹1L","standard":"50 / 30 / 20","details":"Start (non-refundable advance) / design delivery — deemed approved in 7 days / final handover (after final payment)","client":"50% non-refundable advance to start. Design counts as approved 7 days after delivery if no feedback. Handover follows final payment; work pauses if a milestone is 7+ days overdue."},{"policy":"Payment ₹1L–₹5L","standard":"40 / 30 / 20 / 10","details":"Discovery sign-off / design delivery (deemed approved in 7 days) / staging demo / handover (after final payment)","client":"Milestones are tied to deliveries, not waiting time. Invoices payable in 7 days; overdue milestones pause the schedule."},{"policy":"Payment ₹5L+","standard":"Milestone based","details":"Custom schedule","client":"Milestones and payment schedule are defined in the proposal; the same 7-day pay and pause terms apply."},{"policy":"Revisions","standard":"2 rounds per major phase","details":"Extra rounds become change requests","client":"Two reasonable revision rounds are included unless proposal states otherwise."},{"policy":"Scope changes","standard":"Quoted separately","details":"New features, pages, integrations, content","client":"Requests outside approved scope are estimated before implementation."},{"policy":"Third-party costs","standard":"Separate","details":"Hosting, domains, APIs, SaaS, fonts, stock, SMS, etc.","client":"Third-party subscriptions and usage-based services are billed separately unless included."},{"policy":"Rush work","standard":"+10% to +50%","details":"Depends on schedule compression","client":"Accelerated timelines may require a rush premium."},{"policy":"Contingency","standard":"10–25% internal","details":"Depends on uncertainty","client":"Internal buffer is not presented as a hidden line item."},{"policy":"Warranty","standard":"14 days","details":"Bug fixes for delivered scope","client":"Post-launch bug fixes for approved scope are covered for 14 days."},{"policy":"Content","standard":"Client or Arkria","details":"If Arkria creates content, quote separately","client":"Client-supplied content must be provided in agreed formats and timelines."},{"policy":"Handover","standard":"Final payment first","details":"Source/build/access transfer","client":"Production handover and ownership transfer follow final payment."},{"policy":"Due date","standard":"7 days","details":"Invoices payable in 7 days; work pauses past due","client":"Please clear each milestone within 7 days so your launch date holds."},{"policy":"Cancellation","standard":"Kill fee","details":"Advance non-refundable; cancel = completed work or 25% of balance, whichever is higher","client":"If you pause or cancel, the advance stays and completed work plus 25% of the remaining balance is due for reserved time."}];

// Tier order (low → high). Higher tiers include everything in lower tiers.
export const PACKAGE_ORDER = ["Basic", "Business", "Pro", "Experience", "Custom"];

// Basics bundled per tier (names must match FEATURES[].feature).
// A selected feature already in the bundle is NOT charged separately —
// the calculator prices it at ₹0 and marks it "Included".
export const PACKAGE_INCLUDED: Record<string, string[]> = {
  Basic: [
    "Responsive implementation",
    "Basic contact form",
    "WhatsApp button",
    "SEO foundation",
    "Hosting setup",
    "Project management",
    "Micro interactions",
    "Reveal animations",
  ],
  Business: [
    "UI/UX design",
    "Wireframes",
    "Multi-field lead form",
    "WhatsApp lead integration",
    "Analytics setup",
    "Search Console",
    "Basic CMS",
    "On-page SEO",
    "Scroll animations",
    "Performance optimization",
  ],
  Pro: [
    "Design system",
    "Blog CMS",
    "Media library",
    "Multi-step form",
    "CRM integration",
    "Email automation",
    "Technical SEO audit",
    "Schema markup",
    "Image optimization",
    "Parallax",
    "Page transitions",
    "Animated cards",
    "Client training",
    "Technical documentation",
  ],
  Experience: [
    "GSAP timeline",
    "Pinned scrolling",
    "Horizontal scrolling",
    "Advanced CMS",
    "Custom API",
    "API integration",
    "Three.js scene",
    "Security hardening",
    "CDN setup",
    "Prototype",
  ],
  // Custom is scope-based: inherits every lower tier, adds nothing fixed.
  Custom: [],
};

// Union of this tier + every tier below it.
export function getPackageIncluded(pkgName: string): string[] {
  const idx = PACKAGE_ORDER.indexOf(pkgName);
  if (idx < 0) return [];
  const out: string[] = [];
  for (let i = 0; i <= idx; i++) {
    const tier = PACKAGE_ORDER[i];
    for (const f of PACKAGE_INCLUDED[tier] ?? []) {
      if (!out.includes(f)) out.push(f);
    }
  }
  return out;
}

export interface TypePreset {
  // Suggested package, complexity and page count when this product type is picked.
  pkg: string;
  complexity: string;
  pages: number;
  // Feature names (must match FEATURES[].feature) pre-ticked additively.
  // Anything already bundled in the package costs ₹0; the rest is priced.
  features: string[];
}

// Per-product-type starting points. Switching product type applies these
// (extras are preserved — presets only add ticks, never remove them).
export const TYPE_PRESETS: Record<string, TypePreset> = {
  "Landing Page": {
    pkg: "Basic",
    complexity: "Simple",
    pages: 1,
    features: [
      "Landing page",
      "Basic contact form",
      "WhatsApp button",
      "Analytics setup",
      "SEO foundation",
      "Responsive implementation",
      "Micro interactions",
      "Hosting setup",
      "Project management",
    ],
  },
  "Website 3–5 pages": {
    pkg: "Basic",
    complexity: "Standard",
    pages: 4,
    features: [
      "Standard page",
      "Basic contact form",
      "WhatsApp button",
      "Basic CMS",
      "Analytics setup",
      "On-page SEO",
      "SEO foundation",
      "Responsive implementation",
      "UI/UX design",
      "Hosting setup",
      "Project management",
    ],
  },
  "Website 5–8 pages": {
    pkg: "Business",
    complexity: "Standard",
    pages: 6,
    features: [
      "Standard page",
      "Blog CMS",
      "Multi-field lead form",
      "WhatsApp lead integration",
      "Search Console",
      "Performance optimization",
    ],
  },
  "Corporate Website": {
    pkg: "Pro",
    complexity: "Advanced",
    pages: 12,
    features: [
      "Standard page",
      "Complex page",
      "Blog CMS",
      "Media library",
      "Multi-field lead form",
      "Analytics setup",
      "Technical SEO audit",
      "Accessibility pass",
    ],
  },
  "Premium Animated Website": {
    pkg: "Experience",
    complexity: "Advanced",
    pages: 6,
    features: [
      "GSAP timeline",
      "Scroll animations",
      "Pinned scrolling",
      "Page transitions",
      "Parallax",
      "Micro interactions",
      "Prototype",
      "Performance optimization",
      "Image optimization",
    ],
  },
  "Basic E-commerce": {
    pkg: "Pro",
    complexity: "Standard",
    pages: 8,
    features: [
      "WooCommerce setup",
      "Product catalog",
      "Cart",
      "Checkout",
      "Payment gateway",
      "GST/tax setup",
      "Shipping integration",
      "Product filters",
      "Analytics setup",
    ],
  },
  "Custom E-commerce": {
    pkg: "Custom",
    complexity: "Complex",
    pages: 10,
    features: [
      "WooCommerce setup",
      "Product catalog",
      "Cart",
      "Checkout",
      "Payment gateway",
      "GST/tax setup",
      "Shipping integration",
      "Coupons/discounts",
      "Inventory management",
      "Reviews",
      "Wishlist",
      "Advanced search",
      "Admin dashboard",
      "Custom API",
    ],
  },
  "Web App MVP": {
    pkg: "Custom",
    complexity: "Complex",
    pages: 8,
    features: [
      "Authentication",
      "User roles",
      "Admin dashboard",
      "User dashboard",
      "Database design",
      "Custom API",
      "File storage",
      "Notifications",
      "UI/UX design",
      "Responsive implementation",
      "Technical documentation",
      "Project management",
    ],
  },
  "Mobile App MVP": {
    pkg: "Custom",
    complexity: "Complex",
    pages: 8,
    features: [
      "React Native/Flutter app shell",
      "Authentication",
      "Push notifications",
      "App Store deployment",
      "Play Store deployment",
      "Database design",
      "Custom API",
      "UI/UX design",
      "Project management",
    ],
  },
};

