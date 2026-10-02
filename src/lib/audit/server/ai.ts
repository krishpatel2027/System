import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import type { AiAnalysis } from "../types";

// Optional AI interpretation of the first screen and the copy. Everything it
// produces is shown as "AI ANALYSIS" and never mixed with measured data.

const MODEL = "claude-opus-5-5";
export const auditAiEnabled = () => !!(process.env.ANTHROPIC_API_KEY ?? "").trim();

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 2, timeout: 90_000 }));

const answer = z.object({ answer: z.string().describe("One or two sentences, based only on what is visible or written."), clarity: z.enum(["clear", "partial", "unclear"]) });
const sev = z.enum(["critical", "high", "medium", "low", "info"]);

const Schema = z.object({
  firstImpression: z.object({
    whatTheyDo: answer.describe("What the company does, as a first-time visitor would understand it from the first screen."),
    audience: answer.describe("Who the site is for."),
    primaryCta: answer.describe("The main action the first screen asks for, quoting its label."),
    valueProposition: answer.describe("The value proposition, if one is stated."),
    differentiation: answer.describe("What makes them different, if communicated."),
    convincing: answer.describe("Whether the first screen is visually convincing and why."),
    observations: z.array(z.string()).describe("3-5 specific, evidence-based observations about the first screen."),
  }),
  design: z.array(z.object({
    aspect: z.enum(["visual hierarchy", "typography", "spacing", "color", "components", "consistency", "imagery", "brand"]),
    observation: z.string().describe("A specific observation citing what is visible."),
    severity: sev,
    positive: z.boolean(),
  })).describe("4-10 UI / visual design observations."),
  content: z.object({
    whoFor: answer,
    whyChoose: answer,
    whatsDifferent: answer,
    nextStep: answer.describe("What the copy tells the visitor to do next."),
    issues: z.array(z.object({ observation: z.string(), severity: sev })).describe("Copy issues such as vague claims, missing information, repetition or grammar mistakes — quote the text."),
  }),
  positioning: z.string().describe("One or two sentences on how the business positions itself (budget, mid-market, premium) and whether the site's presentation matches."),
});

export interface AiInput { url: string; desktopShot?: string; mobileShot?: string; pages: { url: string; title?: string; h1?: string; text: string }[]; facts: string[] }

export class AuditAiError extends Error { constructor(m: string, public status = 502) { super(m); } }

const img = (dataUrl: string) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: dataUrl.replace(/^data:image\/jpeg;base64,/, "") } });

export async function analyzeWithAi(input: AiInput): Promise<AiAnalysis> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.desktopShot) content.push({ type: "text", text: "Desktop first screen (1440px wide):" }, img(input.desktopShot));
  if (input.mobileShot) content.push({ type: "text", text: "Mobile first screen (390px wide):" }, img(input.mobileShot));
  content.push({
    type: "text",
    text: [
      `Website: ${input.url}`,
      "Measured facts from the automated audit (treat as true):",
      ...input.facts.map((f) => `- ${f}`),
      "",
      "Page text (truncated):",
      ...input.pages.slice(0, 6).map((p) => `### ${p.url}\nTitle: ${p.title ?? "(none)"}\nH1: ${p.h1 ?? "(none)"}\n${p.text.slice(0, 1400)}`),
    ].join("\n"),
  });
  try {
    const msg = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 6000,
      system: [
        "You are a senior web designer and conversion specialist reviewing a business website for a web design studio that works with clients in several countries.",
        "Base every statement ONLY on the screenshots and text provided. Quote visible text where useful.",
        "Never invent numbers, traffic, rankings, revenue, customers, or technical facts. If something can't be judged from what's provided, say so and mark clarity as unclear.",
        "Be fair: note genuine strengths as well as problems. Don't exaggerate severity.",
      ].join("\n"),
      messages: [{ role: "user", content }],
      output_config: { format: betaZodOutputFormat(Schema), effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (msg.stop_reason === "refusal") throw new AuditAiError("The AI declined to analyze this site.", 422);
    if (msg.stop_reason === "max_tokens") throw new AuditAiError("The AI response was cut short.", 502);
    if (!msg.parsed_output) throw new AuditAiError("The AI returned an unreadable response.", 502);
    return { model: msg.model, ...msg.parsed_output } as AiAnalysis;
  } catch (e) {
    if (e instanceof AuditAiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AuditAiError("ANTHROPIC_API_KEY was rejected.", 401);
    if (e instanceof Anthropic.RateLimitError) throw new AuditAiError("AI rate limit reached — try again shortly.", 429);
    if (e instanceof Anthropic.APIError) throw new AuditAiError(`AI request failed (${e.status ?? "network"}).`, 502);
    throw new AuditAiError("AI request failed.", 502);
  }
}
