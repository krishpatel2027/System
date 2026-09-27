import { NextResponse } from "next/server";
import { ConfigError, configProblem, serverLoad } from "@/lib/server-store";
import { migrate } from "@/lib/migrate";

const noStore = { "Cache-Control": "no-store" };

// Public, unauthenticated: returns ONE shared quote or proposal (and only the
// studio details needed to present it) for a secret share token.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  const problem = configProblem();
  if (problem) return NextResponse.json({ error: "This workspace isn't available right now." }, { status: 503, headers: noStore });
  try {
    const db = migrate((await serverLoad()).data);
    if (!db) return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
    const s = db.settings;
    const studio = { studio: s.studio, email: s.email, phone: s.phone, website: s.website, address: s.address, gstin: s.gstin, upi: s.upi, bank: s.bank };
    const quote = db.quotes.find((q) => q.shareToken === token);
    if (quote) {
      const c = db.clients.find((x) => x.id === quote.clientId || x.company === quote.clientName);
      const client = c ? { company: c.company, contactName: c.contactName, email: c.email, phone: c.phone, location: c.location } : null;
      return NextResponse.json({ kind: "quote", quote, client, studio, policies: db.pricing.policies.filter((p) => p.onQuotes) }, { headers: noStore });
    }
    const proposal = db.proposals.find((p) => p.shareToken === token);
    if (proposal) return NextResponse.json({ kind: "proposal", proposal, studio }, { headers: noStore });
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  } catch (e) {
    const status = e instanceof ConfigError ? 503 : 500;
    return NextResponse.json({ error: "This document couldn't be loaded." }, { status, headers: noStore });
  }
}
