import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FullPage } from "@/layouts/full-page";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { usePersistedStore, type VaultColor, type AccountMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { AlertTriangle } from "lucide-react";
import { isValidIdentity, newId } from "@/lib/crypto";
import { parseAccountTags } from "@/lib/accounts";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, createVault, type VaultData } from "@/lib/vault";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
import { parseSignedExportEnvelope } from "@/lib/export-format";

interface ImportFileData {
  name: string;
  color: VaultColor;
  accounts: AccountMeta[];
  vault: VaultData;
  formatVersion: number;
  signatureVerified: boolean;
  legacy: boolean;
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((s) => s.addVault);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const unlock = useSessionStore((s) => s.unlock);
  const hasPendingRequest = useSessionStore((s) => s.pendingRequests.length > 0);

  const [importData, setImportData] = useState<ImportFileData | null>(null);
  const [importPw, setImportPw] = useState("");
  const [importError, setImportError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchName, setWatchName] = useState("");
  const [watchInput, setWatchInput] = useState("");
  const [watchError, setWatchError] = useState("");

  function parseWatchOnlyAccounts(raw: string): AccountMeta[] {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [identityPart, ...labelParts] = line.split(",");
        const identity = identityPart?.trim().toUpperCase() ?? "";
        const label = labelParts.join(",").trim();
        return {
          index,
          name: label || `Account ${index + 1}`,
          addedAt: Date.now(),
          hidden: false,
          identity,
          note: "",
          tags: parseAccountTags("watch-only"),
        };
      });
  }

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = await parseSignedExportEnvelope<{
          glyph: number;
          name: string;
          color: VaultColor;
          accounts: AccountMeta[];
          vault: VaultData;
        }>(text, "vault");
        const envelopePayload = parsed.payload;
        if (envelopePayload.glyph !== 1 || !envelopePayload.vault || !envelopePayload.name?.trim()) throw new Error("bad format");
        const accounts: AccountMeta[] = envelopePayload.accounts ?? [];
        setImportData({
          name: envelopePayload.name,
          color: envelopePayload.color ?? "slate",
          accounts,
          vault: envelopePayload.vault as VaultData,
          formatVersion: parsed.version,
          signatureVerified: parsed.verified,
          legacy: parsed.legacy,
        });
        if (accounts.length > MAX_VAULT_ACCOUNTS) {
          const sorted = [...accounts].sort((a, b) => a.index - b.index);
          setSelectedIndices(new Set(sorted.slice(0, MAX_VAULT_ACCOUNTS).map((a) => a.index)));
        } else {
          setSelectedIndices(new Set());
        }
        setImportPw("");
        setImportError("");
      } catch {
        // malformed or wrong file type — ignore
      }
    };
    input.click();
  }

  function toggleAccount(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else if (next.size < MAX_VAULT_ACCOUNTS) {
        next.add(index);
      }
      return next;
    });
  }

  async function doImport() {
    if (!importData) return;
    setImportLoading(true);
    setImportError("");
    try {
      const allSeeds = await unlockVault(importData.vault, importPw);

      let finalSeeds = allSeeds;
      let finalAccounts = importData.accounts;
      let finalEncryptedData: VaultData = importData.vault;

      if (importData.accounts.length > MAX_VAULT_ACCOUNTS) {
        const sortedSelected = [...selectedIndices].sort((a, b) => a - b);
        finalSeeds = sortedSelected.map((i) => allSeeds[i]);
        const byIndex = new Map(importData.accounts.map((a) => [a.index, a]));
        finalAccounts = sortedSelected.map((origIdx, newIdx) => ({ ...byIndex.get(origIdx)!, index: newIdx }));
        finalEncryptedData = await createVault(importPw, finalSeeds);
      }

      const newVaultId = newId();
      addVault({
        id: newVaultId,
        name: importData.name,
        color: importData.color,
        kind: "seeded",
        createdAt: Date.now(),
        lastUnlockedAt: Date.now(),
        accounts: finalAccounts,
        encryptedData: finalEncryptedData,
      });
      setActiveVault(newVaultId);
      unlock(newVaultId, unlockSecureSession(finalSeeds));
      navigate("/dashboard", { replace: true });
    } catch {
      setImportError("WRONG PASSWORD");
    } finally {
      setImportLoading(false);
    }
  }

  function createWatchOnlyVault() {
    const name = watchName.trim();
    if (!name) {
      setWatchError("NAME REQUIRED");
      return;
    }
    const accounts = parseWatchOnlyAccounts(watchInput);
    if (accounts.length === 0) {
      setWatchError("ADD AT LEAST ONE IDENTITY");
      return;
    }
    if (accounts.some((account) => !account.identity || !isValidIdentity(account.identity))) {
      setWatchError("INVALID IDENTITY IN LIST");
      return;
    }

    const newVaultId = newId();
    addVault({
      id: newVaultId,
      name,
      color: "slate",
      kind: "watch_only",
      createdAt: Date.now(),
      lastUnlockedAt: Date.now(),
      accounts,
      encryptedData: null,
    });
    setActiveVault(newVaultId);
    unlock(newVaultId, [], {
      watchOnly: true,
      identities: accounts.map((account) => account.identity!).filter(Boolean),
    });
    navigate("/dashboard", { replace: true });
  }

  return (
    <FullPage>
      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {hasPendingRequest && (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-status-warning)",
              borderRadius: "var(--radius-sharp)",
            }}
          >
            <AlertTriangle size={14} color="var(--color-status-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em", lineHeight: 1.5 }}>
              A DAPP REQUEST IS WAITING. CREATE OR IMPORT A WALLET TO PROCEED.
            </span>
          </div>
        )}
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-secondary)",
              letterSpacing: "0.15em",
              marginBottom: "var(--space-4)",
            }}
          >
            GLYPH
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-headline)",
              fontWeight: 500,
              color: "var(--color-text-display)",
            }}
          >
            Your keys.<br />Your Qubic.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button variant="primary" shape="pill" onClick={() => navigate("/setup/create")}>
            Create wallet
          </Button>
          <Button variant="secondary" shape="sharp" onClick={() => navigate("/setup/import")}>
            Import seed
          </Button>
          <Button variant="ghost" shape="sharp" onClick={() => setWatchOpen(true)}>
            Import watch-only
          </Button>
          <Button variant="ghost" shape="sharp" onClick={openFilePicker}>
            Import vault file
          </Button>
        </div>
      </div>

      <Modal open={!!importData} onClose={() => setImportData(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-1)" }}>
              Import {importData?.name}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              {importData && importData.accounts.length > MAX_VAULT_ACCOUNTS
                ? `${selectedIndices.size} / ${MAX_VAULT_ACCOUNTS} SELECTED`
                : `${importData?.accounts.length ?? 0} ${(importData?.accounts.length ?? 0) === 1 ? "ACCOUNT" : "ACCOUNTS"}`}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: importData?.signatureVerified ? "var(--color-status-success)" : "var(--color-status-warning)", letterSpacing: "0.05em", marginTop: "var(--space-1)" }}>
              {importData?.legacy ? "[LEGACY FORMAT V1 — IMPORT WITH CARE]" : importData?.signatureVerified ? "[SIGNED EXPORT V2 VERIFIED]" : "[SIGNED EXPORT V2 — SIGNATURE NOT VERIFIED ON THIS DEVICE]"}
            </div>
          </div>

          {importData && importData.accounts.length > MAX_VAULT_ACCOUNTS && (
            <div style={{ maxHeight: 196, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {[...importData.accounts].sort((a, b) => a.index - b.index).map((account) => {
                const selected = selectedIndices.has(account.index);
                const atLimit = !selected && selectedIndices.size >= MAX_VAULT_ACCOUNTS;
                return (
                  <button
                    key={account.index}
                    type="button"
                    onClick={() => toggleAccount(account.index)}
                    disabled={atLimit}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-3)",
                      background: "none", border: "none", textAlign: "left",
                      padding: "var(--space-2) 0", cursor: atLimit ? "not-allowed" : "pointer",
                      opacity: atLimit ? 0.35 : 1,
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", flexShrink: 0, width: 14, color: selected ? "var(--color-text-display)" : "var(--color-text-disabled)" }}>
                      {selected ? "✓" : "○"}
                    </span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: selected ? "var(--color-text-display)" : "var(--color-text-secondary)" }}>
                      {account.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <Input
            type="password"
            label="Vault password"
            value={importPw}
            onChange={(e) => { setImportPw(e.target.value); setImportError(""); }}
            onKeyDown={(e) => e.key === "Enter" && !importLoading && doImport()}
            error={importError}
            placeholder="••••••••••"
            autoComplete="current-password"
            autoFocus
          />
          <Button
            onClick={doImport}
            loading={importLoading}
            disabled={!importPw || (importData !== null && importData.accounts.length > MAX_VAULT_ACCOUNTS && selectedIndices.size === 0)}
          >
            Import vault
          </Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setImportData(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal open={watchOpen} onClose={() => setWatchOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-1)" }}>
              Create watch-only vault
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
              One identity per line. Optional label after a comma.
            </div>
          </div>
          <Input
            label="Vault name"
            value={watchName}
            onChange={(e) => { setWatchName(e.target.value); setWatchError(""); }}
            placeholder="e.g. Treasury, Validators"
            autoFocus
          />
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Identities
            </span>
            <textarea
              value={watchInput}
              onChange={(e) => { setWatchInput(e.target.value); setWatchError(""); }}
              placeholder={"IDENTITYONE..., Main\nIDENTITYTWO..., Cold staking"}
              rows={6}
              style={{
                width: "100%",
                resize: "vertical",
                background: "var(--color-bg-surface)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                padding: "var(--space-3)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-sm)",
                letterSpacing: "0.03em",
              }}
            />
          </label>
          {watchError && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
              {watchError}
            </div>
          )}
          <Button onClick={createWatchOnlyVault}>Create watch-only vault</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setWatchOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </FullPage>
  );
}
