import { useNavigate } from "react-router";
import { AddCircleIcon, ArrowLeft01Icon, KeyRoundIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { PageBanner, PageFrame } from "@/components/page-header";
import { LandscapeOnboarding } from "@/layouts/landscape-onboarding";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { ImportVaultSheet } from "./welcome/import-vault-sheet";
import { Notice } from "./welcome/notice";
import { useVaultFileImport } from "./welcome/use-vault-file-import";
import { VaultFileDrop } from "./welcome/vault-file-drop";

const actionsStyle = { display: "flex", flexDirection: "column" as const, gap: "var(--space-3)" };

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const hasVaults = usePersistedStore((s) => s.vaults.length > 0);
  const isLocked = useSessionStore((s) => s.isLocked);
  const hasPendingRequest = useSessionStore((s) => s.pendingRequests.length > 0);
  const importFlow = useVaultFileImport();

  return (
    <LandscapeOnboarding>
      <PageBanner
        title="Set up your Vault"
        description="Create a new Vault, restore a seed, or import an existing Vault file."
      />

      <PageFrame
        centered
        actions={(
          <div style={actionsStyle}>
            <Button onClick={() => navigate("/setup/create")}>
              <AddCircleIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              Create Vault
            </Button>
            <Button variant="secondary" onClick={() => navigate("/setup/import")}>
              <KeyRoundIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              Restore from seed
            </Button>
          </div>
        )}
      >
        <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)", textAlign: "center" }}>
          {hasVaults ? (
            <button
              type="button"
              onClick={() => navigate(isLocked ? "/lock" : "/dashboard")}
              style={{
                alignSelf: "center",
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: 0,
                border: 0,
                background: "transparent",
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body-compact)",
                cursor: "pointer",
              }}
            >
              <ArrowLeft01Icon size={17} strokeWidth={1.5} aria-hidden="true" />
              Back to Vault
            </button>
          ) : null}

          <VaultFileDrop flow={importFlow} />

          {hasPendingRequest ? <Notice tone="warning">A request is waiting.</Notice> : null}
          {importFlow.importFileError ? <Notice tone="error">{importFlow.importFileError}</Notice> : null}
        </div>
      </PageFrame>

      <ImportVaultSheet flow={importFlow} />
    </LandscapeOnboarding>
  );
}
