import type { Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";

export function contactsToJson(contacts: Contact[]): string {
  return `${JSON.stringify({ version: 1, contacts: contacts.map(portableContact) }, null, 2)}\n`;
}

export function contactsToCsv(contacts: Contact[]): string {
  const rows = [["name", "identity", "tags"], ...contacts.map((contact) => [contact.name, contact.identity, (contact.tags ?? []).join(" ")])];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function parseContactImport(raw: string, path: string): Contact[] {
  const contacts = path.toLowerCase().endsWith(".csv") ? parseContactsCsv(raw) : parseContactsJson(raw);
  const seen = new Set<string>();
  const valid = contacts.map(normalizeImportedContact).filter((contact): contact is Contact => {
    if (!contact || seen.has(contact.identity)) return false;
    seen.add(contact.identity);
    return true;
  });
  if (valid.length === 0) throw new Error("No valid contacts found.");
  return valid;
}

function parseContactsJson(raw: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { contacts?: unknown }).contacts)) return (parsed as { contacts: unknown[] }).contacts;
  throw new Error("Could not import contacts from this JSON file.");
}

function parseContactsCsv(raw: string): unknown[] {
  const rows = parseCsvRows(raw).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (!headers.includes("name") || !headers.includes("identity")) throw new Error("CSV must include name and identity columns.");
  if (rows.slice(1).some((row) => row.length !== headers.length)) throw new Error("Could not import malformed CSV.");
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function normalizeImportedContact(value: unknown): Contact | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
  const identity = typeof record.identity === "string" ? record.identity.trim() : "";
  if (!name || !isValidIdentity(identity)) return null;
  const tags: string[] = Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : typeof record.tags === "string" ? record.tags.split(/[\s,]+/) : [];
  return { id: newId(), name, identity, tags: tags.map((tag) => tag.trim().replace(/^#+/, "").toLowerCase()).filter(Boolean).slice(0, 20), addedAt: Date.now(), lastUsedAt: 0 };
}

function portableContact(contact: Contact) {
  return { name: contact.name, identity: contact.identity, tags: contact.tags ?? [] };
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let justClosedQuote = false;
  let cellStarted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quoted) {
      if (char === '"' && raw[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { quoted = false; justClosedQuote = true; }
      else cell += char;
    } else if (char === '"') {
      if (cellStarted) throw new Error("Could not import malformed CSV.");
      quoted = true;
      cellStarted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
      justClosedQuote = false;
      cellStarted = false;
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      justClosedQuote = false;
      cellStarted = false;
    } else if (char !== "\r") {
      if (justClosedQuote) throw new Error("Could not import malformed CSV.");
      cell += char;
      cellStarted = true;
    }
  }
  if (quoted) throw new Error("Could not import malformed CSV.");
  row.push(cell);
  rows.push(row);
  return rows;
}
