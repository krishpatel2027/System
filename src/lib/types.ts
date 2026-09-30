export type LeadStage =
  | "new"
  | "qualified"
  | "contacted"
  | "replied"
  | "meeting"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type ProjectStatus =
  | "planning"
  | "design"
  | "development"
  | "review"
  | "qa"
  | "launch"
  | "completed";

export type PaymentStatus = "paid" | "pending" | "overdue" | "partial";
export type ScopeStatus =
  | "requested"
  | "estimated"
  | "quoted"
  | "approved"
  | "indev"
  | "completed";

export interface Lead {
  id: string;
  company: string;
  industry: string;
  website?: string;
  instagram?: string;
  location?: string;
  companySize?: string;
  contactName: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  role?: string;
  service: string;
  currentWebsite?: string;
  problem?: string;
  outcome?: string;
  budget?: number;
  timeline?: string;
  references?: string;
  source: string;
  dateAdded: string;
  score: number; // 0-100
  stage: LeadStage;
  nextFollowUp?: string;
  notes?: string;
  // audit
  currentSituation?: string;
  problems?: string;
  opportunities?: string;
  recommended?: string;
  features?: string[];
  estLow?: number;
  estHigh?: number;
  demo?: boolean;
  // Lead Finder link + stage timeline (for conversion analytics).
  prospectId?: string;
  serviceId?: string;
  stageHistory?: { stage: LeadStage; at: string }[];
}

export interface Client {
  id: string;
  company: string;
  industry?: string;
  contactName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
  website?: string;
  instagram?: string;
  notes?: string;
  onboarding?: Record<string, boolean>;
  dateAdded: string;
  demo?: boolean;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  internalCost: number;
  hours: number;
  complexity: "Low" | "Medium" | "High" | "Expert";
  clientFacing: string;
  active: boolean;
  // Lead Finder intelligence: who this service suits and what evidence points to it.
  idealIndustries?: string[];
  signals?: Signal[];
  minBudget?: number;
  maxBudget?: number;
}

export interface PricePackage {
  id: string;
  name: string;
  price: number;
  scope: string;
  bestFor: string;
  highlights: string;
  positioning: string;
  bundle: string[];
  popular?: boolean;
}

export interface RateItem {
  category: string;
  feature: string;
  unit: string;
  entry: number;
  standard: number;
  premium: number;
  notes: string;
}

export interface CarePlan {
  name: string;
  monthly: number;
  hours: number;
  desc: string;
  bestFor: string;
}

export interface Policy {
  policy: string;
  standard: string;
  details: string;
  client: string;
  onQuotes?: boolean;
}

export interface HourlyRate {
  role: string;
  rate: number;
  low: number;
  high: number;
}

export interface PricingConfig {
  packages: PricePackage[];
  features: RateItem[];
  carePlans: CarePlan[];
  policies: Policy[];
  hourly: HourlyRate[];
}

export interface Settings {
  studio: string;
  owner: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  gstin: string;
  upi: string;
  bank: string;
  quotePrefix: string;
  defaultGst: number;
  quoteValidityDays: number;
  paymentTerms: string;
}

export interface QuoteItem {
  id: string;
  label: string;
  qty: number;
  price: number;
}

export interface Quote {
  id: string;
  no: string;
  leadId?: string;
  clientId?: string;
  clientName: string;
  items: QuoteItem[];
  discount: number;
  taxPct: number;
  notes?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  created: string;
  validUntil?: string;
  shareToken?: string;
}

export interface Proposal {
  id: string;
  clientName: string;
  leadId?: string;
  clientId?: string;
  title: string;
  understanding: string;
  opportunity: string;
  approach: string[];
  solution: string;
  sitemap: string[];
  designDirection: string;
  deliverables: string[];
  timeline: string;
  investment: number;
  paymentPlan: { label: string; pct: number }[];
  terms: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  created: string;
  shareToken?: string;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
}

export interface Milestone {
  id: string;
  name: string;
  deadline: string;
  status: "pending" | "in-progress" | "done";
  payment: number;
  deliverables: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  value: number;
  start: string;
  deadline: string;
  manager: string;
  status: ProjectStatus;
  progress: number;
  tasks: Task[];
  milestones: Milestone[];
  notes?: string;
  demo?: boolean;
}

export interface Payment {
  id: string;
  projectId?: string;
  clientName: string;
  amount: number;
  due: string;
  paidDate?: string;
  method?: string;
  txn?: string;
  status: PaymentStatus;
  notes?: string;
  label: string;
}

export interface ScopeChange {
  id: string;
  projectId: string;
  projectName: string;
  feature: string;
  description: string;
  hours: number;
  cost: number;
  timelineImpact: string;
  status: ScopeStatus;
  created: string;
}

export interface MaintenanceSub {
  id: string;
  clientId: string;
  clientName: string;
  plan: string;
  monthly: number;
  renewal: string;
  includedHours: number;
  usedHours: number;
  status: "active" | "paused" | "cancelled";
}

export interface Template {
  id: string;
  category: string;
  title: string;
  body: string;
}

export interface Comm {
  id: string;
  date: string;
  clientName: string;
  channel: string;
  summary: string;
}

// ---------- Lead Finder ----------

// Evidence the analyzer or a provider can observe about a business.
export type Signal =
  | "no_website"
  | "website_unreachable"
  | "outdated_website"
  | "basic_website"
  | "strong_website"
  | "not_mobile_friendly"
  | "slow_website"
  | "weak_seo"
  | "no_https"
  | "no_cta"
  | "no_whatsapp"
  | "no_contact_form"
  | "sells_products"
  | "no_online_store"
  | "booking_business"
  | "support_heavy"
  | "established_business"
  | "active_social"
  | "tech_business";

export type Confidence = "verified" | "detected" | "estimated" | "not_found";
export type SourceId = "google_places" | "serpapi" | "website" | "pagespeed" | "csv" | "manual";
export type WebsiteStatus = "none" | "unreachable" | "outdated" | "basic" | "good" | "unchecked";
export type ProspectStatus = "new" | "reviewing" | "qualified" | "not_fit";

export interface Finding {
  id: string;
  category: "performance" | "mobile" | "seo" | "security" | "conversion" | "content" | "accessibility";
  severity: "high" | "medium" | "low";
  issue: string;
  evidence: string;
  improvement: string;
}

export interface WebsiteAudit {
  url: string;
  finalUrl?: string;
  analyzedAt: string;
  ok: boolean;
  error?: string;
  httpStatus?: number;
  blockedByRobots?: boolean;
  responseMs?: number;
  htmlKb?: number;
  scores: Partial<Record<Finding["category"], number>>;
  findings: Finding[];
  found: {
    title?: string;
    description?: string;
    phones: string[];
    emails: string[];
    whatsapp?: string;
    socials: Partial<Record<"instagram" | "facebook" | "linkedin" | "youtube" | "x", string>>;
    hasViewport: boolean;
    hasForm: boolean;
    hasCta: boolean;
    hasChatWidget: boolean;
    hasCart: boolean;
    sellsProducts: boolean;
    copyrightYear?: number;
    generator?: string;
    internalLinks: number;
  };
  pagespeed?: { strategy: "mobile"; performance: number; accessibility: number; seo: number; bestPractices: number; lcpMs?: number; fetchedAt: string };
}

export interface ScoreBreakdown {
  total: number;
  parts: { website: number; presence: number; maturity: number; contact: number; fit: number; value: number };
  reasons: string[];
}

export interface ServiceMatch {
  serviceId: string;
  serviceName: string;
  price: number;
  cost: number;
  hours: number;
  strength: number; // 0..1
  reasons: string[];
  alternatives: { serviceId: string; serviceName: string; price: number }[];
}

export interface Prospect {
  id: string;
  name: string;
  industry: string;
  category?: string;
  city?: string;
  area?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  socials: Partial<Record<"instagram" | "facebook" | "linkedin" | "youtube" | "x", string>>;
  googleMapsUrl?: string;
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  openingHours?: string[];
  decisionMaker?: { name: string; role: string; source: string; url?: string };
  sources: SourceId[];
  // Where each field came from and how sure we are.
  provenance: Record<string, { source: SourceId; confidence: Confidence }>;
  websiteStatus: WebsiteStatus;
  audit?: WebsiteAudit;
  signals: Signal[];
  evidence: Partial<Record<Signal, string>>;
  score?: ScoreBreakdown;
  match?: ServiceMatch | null;
  status: ProspectStatus;
  leadId?: string;
  notes?: string;
  searchId?: string;
  deepAudit?: { id: string; at: string; overall: number | null; opportunity: number; service?: string };
  discoveredAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  text?: string;
  locations: string[];
  industries: string[];
  website: "any" | "none" | "weak" | "none_or_weak" | "has";
  minScore: number;
  serviceId?: string;
  budgetMax?: number;
  minReviews?: number;
  minRating?: number;
  requireContact?: boolean;
  limit: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  schedule: "manual" | "daily" | "weekly";
  createdAt: string;
  lastRunAt?: string;
}

export interface SearchRun {
  id: string;
  at: string;
  label: string;
  query: SearchQuery;
  source: SourceId;
  found: number;
  added: number;
  duplicates: number;
  qualified: number;
  savedSearchId?: string;
}

export interface ScoringConfig {
  weights: ScoreBreakdown["parts"];
  qualified: number;
  high: number;
}

export interface FinderState {
  scoring: ScoringConfig;
  savedSearches: SavedSearch[];
  history: SearchRun[];
}

export interface DB {
  leads: Lead[];
  clients: Client[];
  services: Service[];
  quotes: Quote[];
  proposals: Proposal[];
  projects: Project[];
  payments: Payment[];
  scopes: ScopeChange[];
  subs: MaintenanceSub[];
  templates: Template[];
  comms: Comm[];
  pricing: PricingConfig;
  settings: Settings;
  prospects: Prospect[];
  finder: FinderState;
  meta: { schema: number };
}
