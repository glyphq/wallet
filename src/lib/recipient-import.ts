import { isValidIdentity } from "@/lib/crypto";

export interface ImportedRecipient {
  identity: string;
  amount: string;
  label?: string;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function normalizeIdentity(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeAmount(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return String(Math.trunc(value));
  if (typeof value !== "string") return "";
  const digits = value.trim().replace(/,/g, "");
  return /^\d+$/.test(digits) ? digits : "";
}

function asRecipient(record: Record<string, unknown>): ImportedRecipient | null {
  const identity = normalizeIdentity(record.identity ?? record.address ?? record.recipient ?? record.to);
  const amount = normalizeAmount(record.amount ?? record.qu ?? record.value);
  const label = typeof record.label === "string" ? record.label.trim() : typeof record.name === "string" ? record.name.trim() : undefined;
  if (!identity || !amount || !isValidIdentity(identity)) return null;
  return { identity, amount, ...(label ? { label } : {}) };
}

export function parseRecipientImport(input: string): ImportedRecipient[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (typeof entry === "object" && entry && !Array.isArray(entry)) return asRecipient(entry as Record<string, unknown>);
          return null;
        })
        .filter((entry): entry is ImportedRecipient => !!entry);
    }
  } catch {
    // fall through to CSV/plaintext parsing
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const parsedLines = lines.map(parseCsvLine);
  const looksLikeHeader = parsedLines[0].some((field) => /identity|address|recipient|to|amount|qu|value/i.test(field));
  const body = looksLikeHeader ? parsedLines.slice(1) : parsedLines;

  return body
    .map((fields) => {
      const identity = normalizeIdentity(fields[0]);
      const amount = normalizeAmount(fields[1]);
      const label = fields[2]?.trim();
      if (!identity || !amount || !isValidIdentity(identity)) return null;
      return { identity, amount, ...(label ? { label } : {}) };
    })
    .filter((entry): entry is ImportedRecipient => !!entry);
}
