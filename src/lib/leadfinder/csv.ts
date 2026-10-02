// Minimal RFC 4180 CSV parse/stringify (quoted fields, embedded commas/newlines).

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const cell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  // Neutralise spreadsheet formula injection from scraped text.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^[-+]?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCSV(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Maps an uploaded header row to the import columns, tolerating naming variations.
export const IMPORT_COLUMNS = ["Business Name", "Industry", "Location", "Country", "Website", "Phone", "Email", "Instagram", "LinkedIn", "Notes"] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const ALIASES: Record<ImportColumn, string[]> = {
  "Business Name": ["business name", "business", "name", "company", "company name", "brand"],
  Industry: ["industry", "category", "type", "sector"],
  Location: ["location", "city", "address", "area"],
  Country: ["country", "country code", "market"],
  Website: ["website", "url", "site", "web", "domain"],
  Phone: ["phone", "mobile", "contact", "phone number", "contact number", "whatsapp"],
  Email: ["email", "e-mail", "mail", "email address"],
  Instagram: ["instagram", "ig", "insta"],
  LinkedIn: ["linkedin", "linked in"],
  Notes: ["notes", "note", "comments", "remarks"],
};

export function mapHeader(header: string[]): Partial<Record<ImportColumn, number>> {
  const out: Partial<Record<ImportColumn, number>> = {};
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const col of IMPORT_COLUMNS) {
    const idx = norm.findIndex((h) => ALIASES[col].includes(h));
    if (idx >= 0) out[col] = idx;
  }
  return out;
}
