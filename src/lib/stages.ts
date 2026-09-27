import type { LeadStage, Proposal, Quote } from "./types";

export const proposalTone = (s: Proposal["status"]) =>
  (s === "accepted" ? "green" : s === "sent" ? "amber" : s === "rejected" ? "red" : "neutral") as "green" | "amber" | "red" | "neutral";

export const quoteTone = (s: Quote["status"]) =>
  (s === "accepted" ? "green" : s === "sent" ? "amber" : s === "rejected" || s === "expired" ? "red" : "neutral") as "green" | "amber" | "red" | "neutral";

export const STAGES: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal sent" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export const OPEN_STAGES = STAGES.filter((s) => s.id !== "won" && s.id !== "lost");

export const leadValue = (l: { estHigh?: number; budget?: number }) => l.estHigh ?? l.budget ?? 0;
