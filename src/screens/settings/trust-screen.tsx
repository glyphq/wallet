import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { Tag } from "@/components/tag";
import { usePersistedStore, type TrustedDappIssuer } from "@/store/persisted";
import { saveFileDialog } from "@/lib/save-file";

interface DraftIssuer {
  id: string | null;
  name: string;
  issuer: string;
  origins: string;
  keyId: string;
  publicJwk: string;
  note: string;
}

const EMPTY_DRAFT: DraftIssuer = {
  id: null,
  name: "",
  issuer: "",
  origins: "",
  keyId: "",
  publicJwk: "",
  note: "",
};

function SummaryCard({ title, body, tag, variant = "neutral" }: { title: string; body: string; tag?: string; variant?: "success" | "warning" | "error" | "neutral" }) {
  return (
    <div style={{ padding: "var(--space-4)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {title}
        </div>
        {tag ? <Tag variant={variant}>{tag}</Tag> : null}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
        {body}
      </div>
    </div>
  );
}

function normalizeOrigins(input: string): string[] {
  return input
    .split(/\r?\n|,/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function serializeIssuer(issuer: TrustedDappIssuer): DraftIssuer {
  return {
    id: issuer.id,
    name: issuer.name,
    issuer: issuer.issuer,
    origins: issuer.origins.join("\n"),
    keyId: issuer.keyId ?? "",
    publicJwk: JSON.stringify(issuer.publicJwk, null, 2),
    note: issuer.note ?? "",
  };
}

function parseIssuerDraft(draft: DraftIssuer): { issuer: Omit<TrustedDappIssuer, "id" | "addedAt" | "status">; error: string | null } {
  if (!draft.name.trim()) return { issuer: null as never, error: "Issuer name is required." };
  if (!draft.issuer.trim()) return { issuer: null as never, error: "Issuer ID is required." };
  const origins = normalizeOrigins(draft.origins);
  if (origins.length === 0) return { issuer: null as never, error: "At least one trusted origin is required." };
  let publicJwk: JsonWebKey;
  try {
    publicJwk = JSON.parse(draft.publicJwk) as JsonWebKey;
  } catch {
    return { issuer: null as never, error: "Public JWK must be valid JSON." };
  }
  if (!publicJwk || typeof publicJwk !== "object" || publicJwk.kty !== "EC" || publicJwk.crv !== "P-256") {
    return { issuer: null as never, error: "Public JWK must be an EC P-256 key." };
  }
  return {
    issuer: {
      name: draft.name.trim(),
      issuer: draft.issuer.trim(),
      origins,
      keyId: draft.keyId.trim() || undefined,
      publicJwk,
      note: draft.note.trim() || undefined,
    },
    error: null,
  };
}

export default function TrustScreen() {
  const navigate = useNavigate();
  const trustedDappIssuers = usePersistedStore((s) => s.trustedDappIssuers);
  const addTrustedDappIssuer = usePersistedStore((s) => s.addTrustedDappIssuer);
  const updateTrustedDappIssuer = usePersistedStore((s) => s.updateTrustedDappIssuer);
  const removeTrustedDappIssuer = usePersistedStore((s) => s.removeTrustedDappIssuer);

  const [draft, setDraft] = useState<DraftIssuer>(EMPTY_DRAFT);
  const [editingOpen, setEditingOpen] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [deleting, setDeleting] = useState<TrustedDappIssuer | null>(null);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCount = trustedDappIssuers.filter((issuer) => issuer.status === "active").length;
  const revokedCount = trustedDappIssuers.filter((issuer) => issuer.status === "revoked").length;

  const sortedIssuers = useMemo(
    () => trustedDappIssuers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [trustedDappIssuers],
  );

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setDraftError("");
    setEditingOpen(true);
  }

  function openEdit(issuer: TrustedDappIssuer) {
    setDraft(serializeIssuer(issuer));
    setDraftError("");
    setEditingOpen(true);
  }

  function saveIssuer() {
    const parsed = parseIssuerDraft(draft);
    if (parsed.error) {
      setDraftError(parsed.error);
      return;
    }

    const payload: TrustedDappIssuer = {
      id: draft.id ?? crypto.randomUUID(),
      addedAt: draft.id
        ? trustedDappIssuers.find((issuer) => issuer.id === draft.id)?.addedAt ?? Date.now()
        : Date.now(),
      status: draft.id
        ? trustedDappIssuers.find((issuer) => issuer.id === draft.id)?.status ?? "active"
        : "active",
      ...parsed.issuer,
    };

    if (draft.id) {
      updateTrustedDappIssuer(draft.id, payload);
    } else {
      addTrustedDappIssuer(payload);
    }
    setEditingOpen(false);
  }

  function toggleIssuerStatus(issuer: TrustedDappIssuer) {
    updateTrustedDappIssuer(issuer.id, {
      status: issuer.status === "active" ? "revoked" : "active",
    });
  }

  async function exportRegistry() {
    await saveFileDialog(
      "sigil-dapp-registry.json",
      JSON.stringify(sortedIssuers, null, 2),
    );
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text()) as unknown;
    } catch {
      setImportError("Registry import must be valid JSON.");
      return;
    }

    if (!Array.isArray(parsed)) {
      setImportError("Registry import must be a JSON array.");
      return;
    }

    let imported = 0;
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const draftItem: DraftIssuer = {
        id: typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : null,
        name: typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name : "",
        issuer: typeof (item as { issuer?: unknown }).issuer === "string" ? (item as { issuer: string }).issuer : "",
        origins: Array.isArray((item as { origins?: unknown[] }).origins)
          ? ((item as { origins: unknown[] }).origins.filter((origin): origin is string => typeof origin === "string")).join("\n")
          : "",
        keyId: typeof (item as { keyId?: unknown }).keyId === "string" ? (item as { keyId: string }).keyId : "",
        publicJwk: JSON.stringify((item as { publicJwk?: JsonWebKey }).publicJwk ?? {}, null, 2),
        note: typeof (item as { note?: unknown }).note === "string" ? (item as { note: string }).note : "",
      };
      const result = parseIssuerDraft(draftItem);
      if (result.error) continue;
      addTrustedDappIssuer({
        id: draftItem.id ?? crypto.randomUUID(),
        addedAt: typeof (item as { addedAt?: unknown }).addedAt === "number" ? (item as { addedAt: number }).addedAt : Date.now(),
        status: (item as { status?: unknown }).status === "revoked" ? "revoked" : "active",
        ...result.issuer,
      });
      imported += 1;
    }

    if (imported === 0) {
      setImportError("No valid issuer entries were found.");
    }
  }

  const statusBar = <ScreenHeader title="Trust" onBack={() => navigate("/settings")} />;

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <SummaryCard
        title="Signed request envelopes"
        tag="shipped"
        variant="success"
        body="Sigil now accepts signed deep-link envelopes, verifies payload hashes, and checks ES256 signatures before approval."
      />
      <SummaryCard
        title="Verified dApp registry"
        tag="shipped"
        variant="success"
        body="Trusted issuers can pin public keys, allowed origins, and revocation state. Verified requests get stronger approval labels; revoked or mismatched issuers are blocked."
      />
      <SummaryCard
        title="Legacy request compatibility"
        tag="compat"
        variant="warning"
        body="Unsigned legacy requests still work, but they remain explicitly unverified and keep the original warning surface."
      />
      <SummaryCard
        title="Export format"
        tag="signed"
        variant="success"
        body="Vault and contact exports continue to use signed metadata format v2, with legacy v1 imports still labeled during import."
      />

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={openCreate}>
          Add issuer
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => fileInputRef.current?.click()}>
          Import registry
        </Button>
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={exportRegistry} disabled={sortedIssuers.length === 0}>
          Export registry
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={handleImportFile} />
      </div>

      {importError && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [{importError}]
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Tag variant="success">{`${activeCount} active`}</Tag>
        <Tag variant="warning">{`${revokedCount} revoked`}</Tag>
      </div>

      {sortedIssuers.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [NO TRUSTED DAPP ISSUERS CONFIGURED]
        </div>
      ) : (
        sortedIssuers.map((issuer) => (
          <div key={issuer.id} style={{ padding: "var(--space-4)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {issuer.name}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                  {issuer.issuer}
                </div>
              </div>
              <Tag variant={issuer.status === "active" ? "success" : "warning"}>
                {issuer.status}
              </Tag>
            </div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
              origins: {issuer.origins.join(", ")}
            </div>
            {issuer.keyId && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                key id: {issuer.keyId}
              </div>
            )}
            {issuer.note && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                {issuer.note}
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => openEdit(issuer)}>
                Edit
              </Button>
              <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => toggleIssuerStatus(issuer)}>
                {issuer.status === "active" ? "Revoke" : "Reactivate"}
              </Button>
              <Button variant="danger" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => setDeleting(issuer)}>
                Remove
              </Button>
            </div>
          </div>
        ))
      )}

      <Modal open={editingOpen} onClose={() => setEditingOpen(false)} title={draft.id ? "Edit issuer" : "Add issuer"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Issuer display name" />
          <Input value={draft.issuer} onChange={(e) => setDraft((current) => ({ ...current, issuer: e.target.value }))} placeholder="Issuer ID (e.g. did:web:app.example)" />
          <textarea
            value={draft.origins}
            onChange={(e) => setDraft((current) => ({ ...current, origins: e.target.value }))}
            placeholder="Trusted origins, one per line"
            rows={4}
            style={{ width: "100%", background: "var(--color-bg-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", padding: "var(--space-3)", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)" }}
          />
          <Input value={draft.keyId} onChange={(e) => setDraft((current) => ({ ...current, keyId: e.target.value }))} placeholder="Optional key ID" />
          <textarea
            value={draft.publicJwk}
            onChange={(e) => setDraft((current) => ({ ...current, publicJwk: e.target.value }))}
            placeholder='Public JWK JSON, for example {"kty":"EC","crv":"P-256",...}'
            rows={8}
            style={{ width: "100%", background: "var(--color-bg-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", padding: "var(--space-3)", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)" }}
          />
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((current) => ({ ...current, note: e.target.value }))}
            placeholder="Optional operator note"
            rows={3}
            style={{ width: "100%", background: "var(--color-bg-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", padding: "var(--space-3)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}
          />
          {draftError && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
              [{draftError}]
            </div>
          )}
          <Button onClick={saveIssuer}>{draft.id ? "Save issuer" : "Add issuer"}</Button>
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Remove issuer">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            Remove {deleting?.name ?? "this issuer"} from the local verified dApp registry?
          </div>
          <Button variant="danger" shape="sharp" onClick={() => { if (deleting) removeTrustedDappIssuer(deleting.id); setDeleting(null); }}>
            Remove issuer
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
