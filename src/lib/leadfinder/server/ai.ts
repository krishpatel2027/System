import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import type { Prospect, SearchQuery } from "../../types";
import { INDUSTRIES } from "../catalog";

// Optional AI layer (ANTHROPIC_API_KEY). Used only where it clearly helps:
// understanding free-text searches and personalising outreach drafts. Every
// caller has a rule-based fallback, so the app works fully without a key.

const MODEL = "claude-opus-5-5";

export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY ?? "").trim();

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 2, timeout: 60_000 }));

export class AiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

async function run<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens: number): Promise<z.infer<T>> {
  try {
    const msg = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: betaZodOutputFormat(schema), effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (msg.stop_reason === "refusal") throw new AiError("The AI declined this request.", 422);
    if (msg.stop_reason === "max_tokens") throw new AiError("The AI response was cut short.", 502);
    if (!msg.parsed_output) throw new AiError("The AI returned an unreadable response.", 502);
    return msg.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("ANTHROPIC_API_KEY was rejected.", 401);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("AI rate limit reached — try again shortly.", 429);
    if (e instanceof Anthropic.APIError) throw new AiError(`AI request failed (${e.status ?? "network"}).`, 502);
    throw new AiError("AI request failed.", 502);
  }
}

// ---------- smart search ----------

const QuerySchema = z.object({
  industries: z.array(z.string()).describe(`Business industries. Prefer these exact names when they fit: ${INDUSTRIES.join(", ")}. Use a short custom name otherwise.`),
  locations: z.array(z.string()).describe("Cities, areas or regions mentioned. Empty if none."),
  website: z.enum(["any", "none", "weak", "none_or_weak", "has"]).describe("none = no website; weak = outdated/poor/slow website; none_or_weak = either; has = must have a site; any = not specified."),
  serviceId: z.enum(["", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]).describe("s1 business website, s2 landing page, s3 premium interactive site, s4 e-commerce, s5 SaaS/dashboard, s6 mobile app, s7 AI chatbot, s8 SEO/performance. Empty if not implied."),
  budgetMax: z.number().describe("Max project budget in INR, 0 if not stated."),
  minRating: z.number().describe("Minimum Google rating 0-5, 0 if not stated."),
  minReviews: z.number().describe("Minimum number of reviews, 0 if not stated."),
  minScore: z.number().describe("Minimum opportunity score 0-100. 70 if the user asks for high/best opportunities, else 0."),
  requireContact: z.boolean().describe("True if the user wants only businesses with a phone or email."),
});

export async function aiParseQuery(text: string): Promise<Partial<SearchQuery>> {
  const r = await run(
    QuerySchema,
    "You convert a sales prospecting request from an Indian web design studio into search filters. Only extract what the request states or clearly implies; leave everything else at its empty value.",
    text.slice(0, 1000),
    1024,
  );
  const out: Partial<SearchQuery> = { industries: r.industries.slice(0, 6), locations: r.locations.slice(0, 8), website: r.website };
  if (r.serviceId) out.serviceId = r.serviceId;
  if (r.budgetMax > 0) out.budgetMax = r.budgetMax;
  if (r.minRating > 0) out.minRating = Math.min(5, r.minRating);
  if (r.minReviews > 0) out.minReviews = r.minReviews;
  if (r.minScore > 0) out.minScore = Math.min(100, r.minScore);
  if (r.requireContact) out.requireContact = true;
  return out;
}

// ---------- outreach ----------

const DraftSchema = z.object({
  subject: z.string().describe("Email subject line; empty for non-email channels."),
  body: z.string(),
});

const CHANNEL_RULES: Record<string, string> = {
  whatsapp: "WhatsApp message: 60–90 words, friendly, no markdown, one question at the end.",
  email: "Email: a specific subject line and a 90–140 word body with a sign-off.",
  instagram: "Instagram DM: 40–70 words, casual and warm.",
  linkedin: "LinkedIn connection note: under 280 characters.",
  call: "Call script with labelled lines: OPEN, REASON, OPPORTUNITY, SOLUTION, QUESTION, CTA, IF BUSY.",
};

// Only verified/detected facts are passed in, and the model is told not to add any.
function facts(p: Prospect) {
  return {
    business: p.name,
    industry: p.industry,
    city: p.city,
    contactName: p.decisionMaker?.name,
    googleReviews: p.reviewCount,
    googleRating: p.rating,
    website: p.website ?? "none found",
    websiteStatus: p.websiteStatus,
    evidence: Object.values(p.evidence),
    auditIssues: p.audit?.findings.slice(0, 5).map((f) => `${f.issue}: ${f.evidence}`),
    pagespeedMobile: p.audit?.pagespeed?.performance,
    recommendedService: p.match?.serviceName,
    startingPriceINR: p.match?.price,
  };
}

export async function aiOutreach(p: Prospect, channel: string, sender: { owner: string; studio: string; website?: string }) {
  const rules = CHANNEL_RULES[channel] ?? CHANNEL_RULES.whatsapp;
  return run(
    DraftSchema,
    [
      `You write first-contact outreach for ${sender.studio}, a web design and development studio in India. The sender is ${sender.owner}.`,
      "Structure: a specific observation about the business → the opportunity it creates → how the studio would solve it → one low-pressure call to action.",
      "Use ONLY the facts provided. Never invent numbers, names, reviews, competitors, results or claims. If a fact is missing, leave it out.",
      "No flattery, no hype words, no emojis, no guarantees. Sound like a thoughtful local professional. This is a draft a human will review before sending.",
      rules,
    ].join("\n"),
    `Facts (JSON):\n${JSON.stringify(facts(p))}\n\nSender website: ${sender.website || "none"}\nChannel: ${channel}`,
    2048,
  );
}
