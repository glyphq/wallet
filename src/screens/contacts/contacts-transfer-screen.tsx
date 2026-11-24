import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { PageFrame } from "@/components/page-header";
import { usePersistedStore } from "@/store/persisted";
import { contactsToCsv, contactsToJson, parseContactImport } from "./contacts-transfer";

export default function ContactsTransferScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contacts = usePersistedStore((s) => s.contacts);
  const addContact = usePersistedStore((s) => s.addContact);

  const fromSettings = searchParams.get("from") === "settings";
  const backTo = fromSettings ? "/settings/contacts" : "/contacts";
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);

  function report(message: string, failed = false) {
    setStatus(message);
    setError(failed);
  }

  async function exportContacts(format: "json" | "csv") {
    report("");
    try {
      const path = await save({
        defaultPath: `glyph-contacts.${format}`,
        filters: [{ name: format === "json" ? "JSON" : "CSV", extensions: [format] }],
      });
      if (!path) return;
      const content = format === "json" ? contactsToJson(contacts) : contactsToCsv(contacts);
      await writeTextFile(path, content);
      report(`Exported ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("[glyph] contact export failed:", err);
      report("Could not export contacts.", true);
    }
  }

  async function importContacts() {
    report("");
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Contacts", extensions: ["json", "csv"] }],
      });
      if (!path || Array.isArray(path)) return;
      const parsed = parseContactImport(await readTextFile(path), path);
      const existingIdentities = new Set(contacts.map((contact) => contact.identity));
      let added = 0;
      for (const contact of parsed) {
        if (existingIdentities.has(contact.identity)) continue;
        existingIdentities.add(contact.identity);
        addContact(contact);
        added += 1;
      }
      report(`Imported ${added} contact${added === 1 ? "" : "s"}${parsed.length > added ? `, skipped ${parsed.length - added} duplicate${parsed.length - added === 1 ? "" : "s"}` : ""}.`);
    } catch (err) {
      console.error("[glyph] contact import failed:", err);
      report(err instanceof Error ? err.message : "Could not import contacts.", true);
    }
  }

  return (
    <AppShell
      fullBleed
      statusBar={<ScreenHeader title="Import / export" onBack={() => navigate(backTo)} backAriaLabel="Back to contacts" />}
      contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}
    >
      <PageFrame
        actions={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Button size="md" style={{ width: "100%" }} onClick={() => void importContacts()}>
              Import JSON or CSV
            </Button>
            <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => void exportContacts("json")} disabled={contacts.length === 0}>
              Export JSON
            </Button>
            <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => void exportContacts("csv")} disabled={contacts.length === 0}>
              Export CSV
            </Button>
          </div>
        )}
      >
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)" }}>
            Import a Glyph contact export or CSV, or export the current address book. Imported addresses already in Glyph are skipped.
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Saved contacts
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)" }}>
              {contacts.length}
            </span>
          </div>
          {status ? (
            <span role={error ? "alert" : "status"} style={{ color: error ? "var(--color-status-error)" : "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)" }}>
              {status}
            </span>
          ) : null}
        </div>
      </PageFrame>
    </AppShell>
  );
}
