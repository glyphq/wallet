import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  DangerTriangle,
  Document,
  DownloadMinimalistic,
  Eye,
  Wallet,
} from "@solar-icons/react";
import { presets } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { Textarea } from "@/components/textarea";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
import { parseAccountTags } from "@/lib/accounts";
import { isValidIdentity, newId } from "@/lib/crypto";
import { parseSignedExportEnvelope } from "@/lib/export-format";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault, type VaultData, unlockVault } from "@/lib/vault";
import { usePersistedStore, type AccountMeta, type VaultColor } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const noticeStyle: Record<"warning" | "error", React.CSSProperties> = {
  warning: {
    color: "var(--color-status-warning)",
    borderColor: "color-mix(in srgb, var(--color-status-warning) 45%, transparent)",
    background: "color-mix(in srgb, var(--color-status-warning) 10%, var(--color-bg-surface))",
  },
  error: {
    color: "var(--color-status-error)",
    borderColor: "color-mix(in srgb, var(--color-status-error) 45%, transparent)",
    background: "color-mix(in srgb, var(--color-status-error) 10%, var(--color-bg-surface))",
  },
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "var(--radius-sheet)",
  padding: "var(--space-5)",
};

interface ImportFileData {
  name: string;
  color: VaultColor;
  accounts: AccountMeta[];
  vault: VaultData;
  formatVersion: number;
  signatureVerified: boolean;
  legacy: boolean;
}

function Notice({ tone, children }: { tone: "warning" | "error"; children: React.ReactNode }) {
  const colors = noticeStyle[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        border: `1px solid ${colors.borderColor}`,
        borderRadius: "var(--radius-surface)",
        background: colors.background,
      }}
    >
      <DangerTriangle size={16} color={colors.color} weight="Linear" style={{ flexShrink: 0, marginTop: 2 }} />
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body-compact)",
          lineHeight: "var(--leading-body)",
          color: colors.color,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 16,
        height: 16,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.6s linear infinite",
      }}
    />
  );
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
  const [importFileError, setImportFileError] = useState("");
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
    setImportFileError("");
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
        if (envelopePayload.glyph !== 1 || !envelopePayload.vault || !envelopePayload.name?.trim()) {
          throw new Error("bad format");
        }
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
          setSelectedIndices(new Set(sorted.slice(0, MAX_VAULT_ACCOUNTS).map((account) => account.index)));
        } else {
          setSelectedIndices(new Set());
        }
        setImportPw("");
        setImportError("");
      } catch {
        setImportData(null);
        setImportPw("");
        setImportError("");
        setImportFileError("Invalid or unsupported vault file. Choose a Glyph export and try again.");
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
        const byIndex = new Map(importData.accounts.map((account) => [account.index, account]));
        finalAccounts = sortedSelected.map((origIdx, newIdx) => ({ ...byIndex.get(origIdx)!, index: newIdx }));
        finalEncryptedData = await createVault(importPw, finalSeeds);
      }

      const wallets = await unlockSecureSession(finalSeeds);
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
      unlock(newVaultId, wallets);
      navigate("/dashboard", { replace: true });
    } catch {
      setImportError("Could not import this vault. Check the password and try again.");
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

  const importNeedsSelection = importData !== null && importData.accounts.length > MAX_VAULT_ACCOUNTS;
  const importDisabled = !importPw || importLoading || (importNeedsSelection && selectedIndices.size === 0);

  return (
    <FullPage centered={false} style={{ justifyContent: "center", paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      <motion.div
        {...presets.fadeIn}
        style={{
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <BrandLockup subtitle="Independent software for Qubic" />

        <FlowHeader
          eyebrow="Setup"
          title="Bring a vault under local control"
          description="Create a new vault, import an existing seed, or open a watch-only workspace without changing wallet logic or request handling."
        />

        {hasPendingRequest ? (
          <Notice tone="warning">
            A dApp request is waiting. Create or import a wallet to review it.
          </Notice>
        ) : null}

        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button onClick={() => navigate("/setup/create")}>
            <Wallet size={18} weight="Bold" />
            Create vault
          </Button>
          <Button variant="secondary" onClick={() => navigate("/setup/import")}>
            <DownloadMinimalistic size={16} weight="Linear" />
            Import seed
          </Button>
          <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => setWatchOpen(true)}>
            <Eye size={16} weight="Linear" />
            Create watch-only vault
          </Button>
          <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={openFilePicker}>
            <Document size={16} weight="Outline" />
            Import vault file
          </Button>
        </div>

        {importFileError ? <Notice tone="error">{importFileError}</Notice> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-caption)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
            }}
          >
            Security boundary
          </span>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-compact)",
              lineHeight: "var(--leading-body)",
              color: "var(--color-text-secondary)",
            }}
          >
            Keys remain encrypted on this device. Signing occurs in the native wallet process after you unlock a vault.
          </p>
        </div>
      </motion.div>

      <Sheet open={!!importData} onClose={() => setImportData(null)} title={`Import ${importData?.name ?? "vault"}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <FlowHeader
            eyebrow="Import file"
            title={importData?.name ?? "Import vault"}
            description={importData && importData.accounts.length > MAX_VAULT_ACCOUNTS
              ? `${selectedIndices.size} of ${MAX_VAULT_ACCOUNTS} account slots selected.`
              : `${importData?.accounts.length ?? 0} ${(importData?.accounts.length ?? 0) === 1 ? "account" : "accounts"} in this export.`}
          />

          <div
            style={{
              ...cardStyle,
              padding: "var(--space-4)",
              borderColor: importData?.signatureVerified ? "color-mix(in srgb, var(--color-status-success) 35%, var(--color-border-default))" : "color-mix(in srgb, var(--color-status-warning) 35%, var(--color-border-default))",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body-compact)",
                lineHeight: "var(--leading-body)",
                color: importData?.signatureVerified ? "var(--color-status-success)" : "var(--color-status-warning)",
              }}
            >
              {importData?.legacy
                ? "Legacy format v1 detected. Import only if you trust the export source."
                : importData?.signatureVerified
                  ? `Signed export v${importData?.formatVersion ?? 2} verified on this device.`
                  : `Signed export v${importData?.formatVersion ?? 2} could not be verified on this device.`}
            </div>
          </div>

          {importNeedsSelection ? (
            <div style={{ ...cardStyle, padding: "var(--space-4)", maxHeight: 220, overflowY: "auto" }}>
              {[...importData.accounts].sort((a, b) => a.index - b.index).map((account, index, accounts) => {
                const selected = selectedIndices.has(account.index);
                const atLimit = !selected && selectedIndices.size >= MAX_VAULT_ACCOUNTS;
                return (
                  <Fragment key={account.index}>
                    <button
                      type="button"
                      onClick={() => toggleAccount(account.index)}
                      disabled={atLimit}
                      aria-pressed={selected}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-3) 0",
                        background: "transparent",
                        border: "none",
                        cursor: atLimit ? "not-allowed" : "pointer",
                        opacity: atLimit ? 0.45 : 1,
                        textAlign: "left",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 999,
                          border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border-default)"}`,
                          color: selected ? "var(--color-accent)" : "var(--color-text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-mono-sm)",
                          flexShrink: 0,
                        }}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: "var(--text-body)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {account.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-mono-sm)",
                            color: "var(--color-text-tertiary)",
                          }}
                        >
                          #{account.index + 1}
                        </span>
                      </div>
                    </button>
                    {index < accounts.length - 1 ? <div style={{ height: 1, background: "var(--color-border-subtle)" }} /> : null}
                  </Fragment>
                );
              })}
            </div>
          ) : null}

          <Input
            label="Vault password"
            type="password"
            value={importPw}
            onChange={(event) => {
              setImportPw(event.target.value);
              setImportError("");
            }}
            onKeyDown={(event) => event.key === "Enter" && !importLoading && doImport()}
            placeholder="Enter the export password"
            autoComplete="current-password"
            autoFocus
            error={importError}
          />

          <Button onClick={doImport} disabled={importDisabled} loading={importLoading}>
            {importLoading ? <Spinner /> : null}
            Import vault
          </Button>
        </div>
      </Sheet>

      <Sheet open={watchOpen} onClose={() => setWatchOpen(false)} title="Create watch-only vault">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <FlowHeader
            eyebrow="Watch only"
            title="Create a read-only vault"
            description="Add one identity per line. You can include an optional label after a comma."
          />

          <Input
            label="Vault name"
            value={watchName}
            onChange={(event) => {
              setWatchName(event.target.value);
              setWatchError("");
            }}
            placeholder="Treasury, validators, cold wallet"
            autoFocus
          />

          <Textarea
            label="Identities"
            technical
            rows={6}
            value={watchInput}
            onChange={(event) => {
              setWatchInput(event.target.value);
              setWatchError("");
            }}
            placeholder={"IDENTITYONE..., Main\nIDENTITYTWO..., Cold staking"}
            hint="Each line becomes an account. Labels are optional."
            error={watchError}
          />

          <Button onClick={createWatchOnlyVault}>Create watch-only vault</Button>
        </div>
      </Sheet>
    </FullPage>
  );
}
