export type LeadStage =
  | "new"
  | "contacted"
  | "interested"
  | "discovery"
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
}

export interface Package {
  id: string;
  name: string;
  tagline: string;
  low: number;
  high: number | null;
  features: string[];
  best?: boolean;
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

export interface DB {
  leads: Lead[];
  clients: Client[];
  services: Service[];
  packages: Package[];
  quotes: Quote[];
  proposals: Proposal[];
  projects: Project[];
  payments: Payment[];
  scopes: ScopeChange[];
  subs: MaintenanceSub[];
  templates: Template[];
  comms: Comm[];
  settings: { studio: string; owner: string; email: string; phone: string; upi: string };
}
