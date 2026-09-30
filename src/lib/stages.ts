import type { LeadStage, Proposal, Quote } from "./types";

export const proposalTone = (s: Proposal["status"]) =>
  (s === "accepted" ? "green" : s === "sent" ? "amber" : s === "rejected" ? "red" : "neutral") as "green" | "amber" | "red" | "neutral";

export const quoteTone = (s: Quote["status"]) =>
  (s === "accepted" ? "green" : s === "sent" ? "amber" : s === "rejected" || s === "expired" ? "red" : "neutral") as "green" | "amber" | "red" | "neutral";

export const STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export const stageIndex = (s: LeadStage) => STAGES.findIndex((x) => x.id === s);

// Moves a lead to a stage and records when, so conversion rates are measurable.
export function withStage<T extends { stage: LeadStage; stageHistory?: { stage: LeadStage; at: string }[] }>(lead: T, stage: LeadStage): T {
  if (lead.stage === stage) return lead;
  return { ...lead, stage, stageHistory: [...(lead.stageHistory ?? []), { stage, at: new Date().toISOString() }] };
}

export const OPEN_STAGES = STAGES.filter((s) => s.id !== "won" && s.id !== "lost");

export const leadValue = (l: { estHigh?: number; budget?: number }) => l.estHigh ?? l.budget ?? 0;
