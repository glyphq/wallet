import { useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { presets, gesture } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type VaultColor, type AccountMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import {
  DangerTriangle,
  Wallet,
  DownloadMinimalistic,
  Eye,
  Document,
} from "@solar-icons/react";
import { isValidIdentity, newId } from "@/lib/crypto";
import { parseAccountTags } from "@/lib/accounts";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, createVault, type VaultData } from "@/lib/vault";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
import { parseSignedExportEnvelope } from "@/lib/export-format";

/* ------------------------------------------------------------------ */
/*  Shared inline styles                                               */
/* ------------------------------------------------------------------ */

const accentBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "var(--space-2)",
  width: "100%", height: 48,
  background: "var(--color-accent)", color: "var(--color-bg-base)",
  borderRadius: "var(--radius-pill)", border: "none",
  fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "var(--text-body)",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "var(--space-2)",
  width: "100%", height: 44,
  background: "transparent", color: "var(--color-text-primary)",
  borderRadius: "var(--radius-sharp)", border: "1px solid var(--color-border-strong)",
  fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "var(--space-2)",
  width: "100%", height: 40,
  background: "transparent", color: "var(--color-text-secondary)",
  borderRadius: 0, border: "none",
  fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "var(--text-body)",
  cursor: "pointer",
};

const inputField: React.CSSProperties = {
  background: "transparent", border: "none",
  borderBottom: "1px solid var(--color-border-strong)",
  borderRadius: 0, padding: "var(--space-3) 0",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
  color: "var(--color-text-display)", width: "100%", outline: "none",
};

const fieldLabel: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
  fontWeight: 500, color: "var(--color-text-disabled)",
};

const rowDivider: React.CSSProperties = {
  height: 1,
  background: "var(--color-border-subtle)",
  margin: "0 calc(-1 * var(--space-4))",
};

function Spinner() {
  return (
    <span style={{
      width: 16, height: 16,
      border: "2px solid currentColor", borderTopColor: "transparent",
      borderRadius: "50%", animation: "spin 0.6s linear infinite",
    }} />
  );
}

/* ------------------------------------------------------------------ */
/*  Import file data shape                                             */
/* ------------------------------------------------------------------ */

interface ImportFileData {
  name: string;
  color: VaultColor;
  accounts: AccountMeta[];
  vault: VaultData;
  formatVersion: number;
  signatureVerified: boolean;
  legacy: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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

  /* ---- business logic (unchanged) ---- */

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
      setImportError("Wrong password. Please check and try again.");
    } finally {
      setImportLoading(false);
    }
  }

  function createWatchOnlyVault() {
    const name = watchName.trim();
    if (!name) {
      setWatchError("Please enter a vault name");
      return;
    }
    const accounts = parseWatchOnlyAccounts(watchInput);
    if (accounts.length === 0) {
      setWatchError("Add at least one identity");
      return;
    }
    if (accounts.some((account) => !account.identity || !isValidIdentity(account.identity))) {
      setWatchError("One or more identities are invalid. Check the format and try again.");
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

  /* ---- render ---- */

  return (
    <FullPage>
      <motion.div
        {...presets.fadeIn}
        style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
      >
        {/* Pending request warning */}
        {hasPendingRequest && (
          <div
            role="status"
            style={{
              display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-status-warning)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <DangerTriangle size={14} color="var(--color-status-warning)" weight="Linear" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-warning)", lineHeight: 1.5 }}>
              A dApp request is waiting. Create or import a wallet to proceed.
            </span>
          </div>
        )}

        {/* Brand + tagline */}
        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.1em", marginBottom: "var(--space-4)" }}>
            Glyph
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, lineHeight: 1.25 }}>
            <span style={{ color: "var(--color-text-display)" }}>Your keys.</span>
            <br />
            <span style={{ color: "var(--color-accent)" }}>Your Qubic.</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <motion.button type="button" onClick={() => navigate("/setup/create")} {...gesture.press} style={accentBtn}>
            <Wallet size={18} weight="Bold" />
            Create wallet
          </motion.button>
          <motion.button type="button" onClick={() => navigate("/setup/import")} {...gesture.press} style={secondaryBtn}>
            <DownloadMinimalistic size={16} weight="Linear" />
            Import seed
          </motion.button>
          <motion.button type="button" onClick={() => setWatchOpen(true)} {...gesture.pressSubtle} style={ghostBtn}>
            <Eye size={16} weight="Linear" />
            Import watch-only
          </motion.button>
          <motion.button type="button" onClick={openFilePicker} {...gesture.pressSubtle} style={ghostBtn}>
            <Document size={16} weight="Outline" />
            Import vault file
          </motion.button>
        </div>
      </motion.div>

      {/* ---- Import vault file modal ---- */}
      <Sheet open={!!importData} onClose={() => setImportData(null)} title={`Import ${importData?.name ?? ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>
              {importData && importData.accounts.length > MAX_VAULT_ACCOUNTS
                ? `${selectedIndices.size} / ${MAX_VAULT_ACCOUNTS} selected`
                : `${importData?.accounts.length ?? 0} ${(importData?.accounts.length ?? 0) === 1 ? "account" : "accounts"}`}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: importData?.signatureVerified ? "var(--color-status-success)" : "var(--color-status-warning)", marginTop: "var(--space-1)" }}>
              {importData?.legacy
                ? "Legacy format v1 — import with care"
                : importData?.signatureVerified
                  ? "Signed export v2 verified"
                  : "Signed export v2 — signature not verified on this device"}
            </div>
          </div>

          {/* Account selection list */}
          {importData && importData.accounts.length > MAX_VAULT_ACCOUNTS && (
            <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", maxHeight: 196, overflowY: "auto" }}>
              {[...importData.accounts].sort((a, b) => a.index - b.index).map((account, i, arr) => {
                const selected = selectedIndices.has(account.index);
                const atLimit = !selected && selectedIndices.size >= MAX_VAULT_ACCOUNTS;
                return (
                  <Fragment key={account.index}>
                    <motion.button
                      type="button"
                      onClick={() => toggleAccount(account.index)}
                      disabled={atLimit}
                      {...gesture.pressSubtle}
                      style={{
                        display: "flex", alignItems: "center", gap: "var(--space-3)",
                        background: "none", border: "none", textAlign: "left",
                        padding: "var(--space-3) 0", cursor: atLimit ? "not-allowed" : "pointer",
                        opacity: atLimit ? 0.35 : 1, width: "100%",
                      }}
                    >
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
                        flexShrink: 0, width: 14,
                        color: selected ? "var(--color-accent)" : "var(--color-text-disabled)",
                      }}>
                        {selected ? "✓" : "○"}
                      </span>
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: selected ? "var(--color-text-display)" : "var(--color-text-secondary)" }}>
                        {account.name}
                      </span>
                    </motion.button>
                    {i < arr.length - 1 && <div style={rowDivider} />}
                  </Fragment>
                );
              })}
            </div>
          )}

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={fieldLabel}>Vault password</label>
            <input
              type="password"
              value={importPw}
              onChange={(e) => { setImportPw(e.target.value); setImportError(""); }}
              onKeyDown={(e) => e.key === "Enter" && !importLoading && doImport()}
              placeholder="••••••••••"
              autoComplete="current-password"
              spellCheck={false}
              autoCapitalize="none"
              aria-label="Vault password"
              autoFocus
              style={inputField}
            />
            {importError && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
                {importError}
              </span>
            )}
          </div>

          {/* Actions */}
          <motion.button
            type="button"
            onClick={doImport}
            disabled={!importPw || importLoading || (importData !== null && importData.accounts.length > MAX_VAULT_ACCOUNTS && selectedIndices.size === 0)}
            {...gesture.press}
            style={{ ...accentBtn, opacity: (!importPw || importLoading || (importData !== null && importData.accounts.length > MAX_VAULT_ACCOUNTS && selectedIndices.size === 0)) ? 0.4 : 1, cursor: (!importPw || importLoading) ? "not-allowed" : "pointer" }}
          >
            {importLoading ? <Spinner /> : "Import vault"}
          </motion.button>
        </div>
      </Sheet>

      {/* ---- Watch-only modal ---- */}
      <Sheet open={watchOpen} onClose={() => setWatchOpen(false)} title="Create watch-only vault">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            One identity per line. Optional label after a comma.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={fieldLabel}>Vault name</label>
            <input
              value={watchName}
              onChange={(e) => { setWatchName(e.target.value); setWatchError(""); }}
              placeholder="e.g. Treasury, Validators"
              autoFocus
              style={inputField}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={fieldLabel}>Identities</label>
            <textarea
              value={watchInput}
              onChange={(e) => { setWatchInput(e.target.value); setWatchError(""); }}
              placeholder={"IDENTITYONE..., Main\nIDENTITYTWO..., Cold staking"}
              rows={6}
              style={{
                width: "100%", resize: "vertical",
                background: "transparent",
                color: "var(--color-text-primary)",
                border: "none",
                borderBottom: "1px solid var(--color-border-strong)",
                borderRadius: 0,
                padding: "var(--space-3) 0",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-sm)",
                lineHeight: 1.6,
              }}
            />
          </div>

          {watchError && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
              {watchError}
            </span>
          )}

          <motion.button type="button" onClick={createWatchOnlyVault} {...gesture.press} style={accentBtn}>
            Create watch-only vault
          </motion.button>
        </div>
      </Sheet>
    </FullPage>
  );
}
