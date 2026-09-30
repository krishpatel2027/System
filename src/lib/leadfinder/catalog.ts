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

// City-centre coordinates, used as the map position for providers that need one.
export const CITY_COORDS: Record<string, [number, number]> = {
  ahmedabad: [23.0225, 72.5714], gandhinagar: [23.2156, 72.6369], surat: [21.1702, 72.8311], vadodara: [22.3072, 73.1812],
  rajkot: [22.3039, 70.8022], mumbai: [19.076, 72.8777], "navi mumbai": [19.033, 73.0297], thane: [19.2183, 72.9781],
  pune: [18.5204, 73.8567], nagpur: [21.1458, 79.0882], delhi: [28.7041, 77.1025], "new delhi": [28.6139, 77.209],
  "delhi ncr": [28.6139, 77.209], gurugram: [28.4595, 77.0266], gurgaon: [28.4595, 77.0266], noida: [28.5355, 77.391],
  bengaluru: [12.9716, 77.5946], bangalore: [12.9716, 77.5946], hyderabad: [17.385, 78.4867], chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639], jaipur: [26.9124, 75.7873], udaipur: [24.5854, 73.7125], indore: [22.7196, 75.8577],
  bhopal: [23.2599, 77.4126], lucknow: [26.8467, 80.9462], chandigarh: [30.7333, 76.7794], kochi: [9.9312, 76.2673],
  coimbatore: [11.0168, 76.9558], goa: [15.4909, 73.8278], nashik: [19.9975, 73.7898], visakhapatnam: [17.6868, 83.2185],
  mysuru: [12.2958, 76.6394],
};

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
