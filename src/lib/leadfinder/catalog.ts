import type { ScoringConfig, Service, Signal } from "../types";

export const INDUSTRIES = [
  "Real Estate", "Interior Design", "Architecture", "Construction", "Restaurants", "Cafes", "Hotels",
  "Clinics", "Dental Clinics", "Hospitals", "Gyms", "Fitness Studios", "Salons", "Beauty", "Education",
  "Coaching", "Schools", "Manufacturing", "Law Firms", "Finance", "Chartered Accountants", "Consulting",
  "Travel", "Automotive", "Furniture", "Fashion", "Jewellery", "Home Services", "B2B Services", "SaaS",
  "Technology", "E-commerce", "Event Management", "Photography", "Pet Services", "Local Businesses",
  "Professional Services",
];

export const CITIES = [
  "Ahmedabad", "Gandhinagar", "Surat", "Vadodara", "Rajkot", "Mumbai", "Navi Mumbai", "Thane", "Pune", "Nagpur",
  "Delhi", "New Delhi", "Delhi NCR", "Gurugram", "Gurgaon", "Noida", "Bengaluru", "Bangalore", "Hyderabad", "Chennai",
  "Kolkata", "Jaipur", "Udaipur", "Indore", "Bhopal", "Lucknow", "Chandigarh", "Kochi", "Coimbatore", "Goa",
  "Nashik", "Visakhapatnam", "Mysuru", "India",
];

export const SIGNALS: Record<Signal, { label: string; kind: "opportunity" | "strength" | "context" }> = {
  no_website: { label: "No website", kind: "opportunity" },
  website_unreachable: { label: "Website not loading", kind: "opportunity" },
  outdated_website: { label: "Outdated website", kind: "opportunity" },
  basic_website: { label: "Basic website", kind: "opportunity" },
  strong_website: { label: "Strong website", kind: "strength" },
  not_mobile_friendly: { label: "Not mobile-friendly", kind: "opportunity" },
  slow_website: { label: "Slow website", kind: "opportunity" },
  weak_seo: { label: "Weak SEO basics", kind: "opportunity" },
  no_https: { label: "No HTTPS", kind: "opportunity" },
  no_cta: { label: "No clear call to action", kind: "opportunity" },
  no_whatsapp: { label: "No WhatsApp contact", kind: "opportunity" },
  no_contact_form: { label: "No contact form", kind: "opportunity" },
  sells_products: { label: "Sells products", kind: "context" },
  no_online_store: { label: "No online store", kind: "opportunity" },
  booking_business: { label: "Appointment-based", kind: "context" },
  support_heavy: { label: "High enquiry volume", kind: "context" },
  established_business: { label: "Established business", kind: "strength" },
  active_social: { label: "Active on social", kind: "strength" },
  tech_business: { label: "Tech / platform business", kind: "context" },
};

export const ALL_SIGNALS = Object.keys(SIGNALS) as Signal[];

type Intel = Required<Pick<Service, "idealIndustries" | "signals" | "minBudget" | "maxBudget">>;

// Starting intelligence for the default catalog (ids from seed.ts). Editable in Services.
export const DEFAULT_SERVICE_INTEL: Record<string, Intel> = {
  s1: {
    signals: ["no_website", "website_unreachable", "outdated_website", "basic_website", "not_mobile_friendly", "no_contact_form"],
    idealIndustries: ["Real Estate", "Interior Design", "Architecture", "Construction", "Clinics", "Dental Clinics", "Restaurants", "Cafes", "Law Firms", "Chartered Accountants", "Consulting", "Education", "Coaching", "Schools", "Salons", "Gyms", "Fitness Studios", "Manufacturing", "Travel", "Automotive", "Hotels", "Home Services", "B2B Services", "Professional Services", "Local Businesses", "Photography", "Event Management"],
    minBudget: 25000, maxBudget: 60000,
  },
  s2: {
    signals: ["no_cta", "no_contact_form", "no_whatsapp"],
    idealIndustries: ["Coaching", "Education", "Real Estate", "Clinics", "Dental Clinics", "Gyms", "Fitness Studios", "Event Management", "SaaS"],
    minBudget: 10000, maxBudget: 25000,
  },
  s3: {
    signals: ["outdated_website", "basic_website", "established_business", "active_social"],
    idealIndustries: ["Interior Design", "Architecture", "Real Estate", "Hotels", "Jewellery", "Fashion", "Furniture", "Photography", "Beauty"],
    minBudget: 60000, maxBudget: 150000,
  },
  s4: {
    signals: ["sells_products", "no_online_store"],
    idealIndustries: ["Fashion", "Jewellery", "Furniture", "E-commerce", "Beauty", "Manufacturing", "Home Services"],
    minBudget: 70000, maxBudget: 200000,
  },
  s5: {
    signals: ["tech_business"],
    idealIndustries: ["SaaS", "Technology", "B2B Services", "Finance", "Education"],
    minBudget: 150000, maxBudget: 500000,
  },
  s6: {
    signals: ["booking_business", "established_business"],
    idealIndustries: ["Fitness Studios", "Gyms", "Restaurants", "Salons", "Education", "Clinics", "Hotels"],
    minBudget: 150000, maxBudget: 500000,
  },
  s7: {
    signals: ["support_heavy", "booking_business"],
    idealIndustries: ["Clinics", "Dental Clinics", "Hospitals", "Education", "Coaching", "Real Estate", "Hotels", "Travel", "E-commerce"],
    minBudget: 40000, maxBudget: 100000,
  },
  s8: {
    signals: ["slow_website", "weak_seo", "no_https", "not_mobile_friendly"],
    idealIndustries: [],
    minBudget: 8000, maxBudget: 25000,
  },
};

export const DEFAULT_SCORING: ScoringConfig = {
  weights: { website: 25, presence: 15, maturity: 15, contact: 15, fit: 20, value: 10 },
  qualified: 60,
  high: 80,
};

export const PART_LABELS: Record<keyof ScoringConfig["weights"], string> = {
  website: "Website opportunity",
  presence: "Digital presence",
  maturity: "Business maturity",
  contact: "Contactability",
  fit: "Service fit",
  value: "Project value",
};

export function withServiceIntel(s: Service): Service {
  const intel = DEFAULT_SERVICE_INTEL[s.id];
  return {
    ...s,
    idealIndustries: s.idealIndustries ?? intel?.idealIndustries ?? [],
    signals: s.signals ?? intel?.signals ?? [],
    minBudget: s.minBudget ?? intel?.minBudget,
    maxBudget: s.maxBudget ?? intel?.maxBudget,
  };
}
