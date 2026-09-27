import type { DB, Settings } from "./types";
import { DEFAULT_PRICING } from "./pricing-data";

export const SCHEMA_VERSION = 2;

export const ONBOARDING_ITEMS = [
  "Logo received",
  "Brand assets received",
  "Images received",
  "Videos received",
  "Website content received",
  "Contact information received",
  "Social media links received",
  "Domain access received",
  "Hosting access received",
  "API credentials received",
  "CMS requirements confirmed",
  "Project scope confirmed",
];

export const DEFAULT_SETTINGS: Settings = {
  studio: "Arkria",
  owner: "Krish",
  email: "hello@arkria.in",
  phone: "",
  website: "",
  address: "",
  gstin: "",
  upi: "",
  bank: "",
  quotePrefix: "ARK",
  defaultGst: 18,
  quoteValidityDays: 14,
  paymentTerms: "50% advance to begin · 30% at development milestone · 20% on launch.",
};

// A fresh workspace: real catalog + templates + default pricing, no records.
export const seedDB: DB = {
  leads: [],
  clients: [],
  services: [
    { id: "s1", name: "Business Website", category: "Websites", description: "5-8 page credibility + lead site", basePrice: 38000, internalCost: 20000, hours: 60, complexity: "Medium", clientFacing: "Custom-designed, mobile-first website with lead capture and SEO setup.", active: true },
    { id: "s2", name: "Landing Page", category: "Websites", description: "High-converting campaign page", basePrice: 16000, internalCost: 8000, hours: 24, complexity: "Low", clientFacing: "Focused landing page engineered for conversions.", active: true },
    { id: "s3", name: "Premium Interactive Website", category: "Websites", description: "GSAP / motion / editorial", basePrice: 85000, internalCost: 45000, hours: 140, complexity: "Expert", clientFacing: "Award-level interactive experience with advanced motion.", active: true },
    { id: "s4", name: "Custom E-commerce", category: "E-commerce", description: "Catalog + payments + shipping", basePrice: 95000, internalCost: 55000, hours: 160, complexity: "High", clientFacing: "Full store with payments, shipping and inventory.", active: true },
    { id: "s5", name: "SaaS / Dashboard", category: "Web Applications", description: "Auth, roles, dashboards, API", basePrice: 180000, internalCost: 110000, hours: 300, complexity: "Expert", clientFacing: "Scalable web app with dashboards and integrations.", active: true },
    { id: "s6", name: "Cross-platform Mobile App", category: "Mobile Apps", description: "Customer + admin app", basePrice: 220000, internalCost: 140000, hours: 380, complexity: "Expert", clientFacing: "iOS + Android app from one codebase.", active: true },
    { id: "s7", name: "AI Chatbot", category: "AI", description: "Support / lead bot on your data", basePrice: 60000, internalCost: 32000, hours: 90, complexity: "High", clientFacing: "AI assistant trained on your business.", active: true },
    { id: "s8", name: "SEO + Performance", category: "Ongoing", description: "Core vitals, metadata, speed", basePrice: 12000, internalCost: 5000, hours: 16, complexity: "Medium", clientFacing: "Faster site, better rankings.", active: true },
  ],
  quotes: [],
  proposals: [],
  projects: [],
  payments: [],
  scopes: [],
  subs: [],
  templates: [
    { id: "tm1", category: "WhatsApp", title: "First Contact", body: "Hi {{name}}, this is {{me}} from {{studio}} — we build premium websites for real-estate brands. Saw {{company}} — quick idea to lift enquiries. Open to a 15-min call?" },
    { id: "tm2", category: "Follow-up", title: "Follow-up 1 (2 days)", body: "Hi {{name}}, just bumping the proposal for {{company}} ({{amount}}). Happy to walk through scope on a quick call. — {{me}}, {{studio}}" },
    { id: "tm3", category: "Email", title: "Proposal Sent", body: "Subject: {{studio}} × {{company}} — proposal inside\n\nHi {{name}},\n\nAttached is the proposal: scope, timeline and investment ({{amount}}). Valid till {{date}}.\n\nNext step: 20-min review call?\n\n— {{me}}" },
    { id: "tm4", category: "Payment", title: "Payment Reminder", body: "Hi {{name}}, friendly reminder: {{label}} of {{amount}} was due {{date}}. UPI: {{upi}}. Reply once done and I'll confirm instantly. — {{studio}}" },
    { id: "tm5", category: "Project", title: "Project Started", body: "Hi {{name}}, advance received — your project is now active. Onboarding checklist: logo, content, accesses. Let's launch strong. — {{studio}}" },
    { id: "tm6", category: "Maintenance", title: "Maintenance Offer", body: "Hi {{name}}, your site is live. To keep it fast + safe, our care plans start at ₹2,500/mo. Want me to set up the Standard plan for {{company}}?" },
  ],
  comms: [],
  pricing: DEFAULT_PRICING,
  settings: DEFAULT_SETTINGS,
  meta: { schema: SCHEMA_VERSION },
};
