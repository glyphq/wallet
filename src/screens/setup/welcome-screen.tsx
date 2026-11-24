import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { AddCircleIcon, ArrowLeft01Icon, FolderOpenIcon, KeyRoundIcon } from "@/lib/icons";
import { presets } from "@/lib/animations";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { LandscapeOnboarding } from "@/layouts/landscape-onboarding";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { ImportVaultSheet } from "./welcome/import-vault-sheet";
import { Notice } from "./welcome/notice";
import { useVaultFileImport } from "./welcome/use-vault-file-import";

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const hasVaults = usePersistedStore((s) => s.vaults.length > 0);
  const isLocked = useSessionStore((s) => s.isLocked);
  const hasPendingRequest = useSessionStore((s) => s.pendingRequests.length > 0);
  const importFlow = useVaultFileImport();

  return (
    <LandscapeOnboarding>
      <motion.div
        {...presets.fadeIn}
        style={{ width: "100%", maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        {hasVaults ? (
          <button
            type="button"
            onClick={() => navigate(isLocked ? "/lock" : "/dashboard")}
            style={{
              alignSelf: "flex-start",
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

        <BrandLockup size={42} iconOnly />

        <FlowHeader
          title="Set up your Vault"
          description="Create a new Vault, restore a seed, or import an existing Vault file."
        />

        {hasPendingRequest ? <Notice tone="warning">A request is waiting.</Notice> : null}
        {importFlow.importFileError ? <Notice tone="error">{importFlow.importFileError}</Notice> : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button onClick={() => navigate("/setup/create")}>
            <AddCircleIcon size={18} strokeWidth={1.5} aria-hidden="true" />
            Create Vault
          </Button>
          <Button variant="secondary" onClick={() => navigate("/setup/import")}>
            <KeyRoundIcon size={18} strokeWidth={1.5} aria-hidden="true" />
            Restore from seed
          </Button>
          <Button variant="ghost" size="md" onClick={importFlow.openFilePicker}>
            <FolderOpenIcon size={18} strokeWidth={1.5} aria-hidden="true" />
            Import Vault file
          </Button>
        </div>

        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
          Keys stay encrypted on this device. Glyph cannot recover a forgotten password or seed.
        </p>
      </motion.div>

      <ImportVaultSheet flow={importFlow} />
    </LandscapeOnboarding>
  );
}
