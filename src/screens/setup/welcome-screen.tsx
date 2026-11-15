import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { AddCircleIcon, ArrowLeft01Icon, FolderOpenIcon, KeyRoundIcon } from "@/lib/icons";
import { presets } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
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
    <FullPage centered={false} style={{ justifyContent: "center", paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      <motion.div
        {...presets.fadeIn}
        style={{
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-8)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
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
                marginBottom: "calc(var(--space-2) * -1)",
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
          <BrandLockup align="center" iconOnly />

          <FlowHeader
            align="center"
            title="Set up your Vault"
          />

          {hasPendingRequest ? (
            <Notice tone="warning">
              A request is waiting.
            </Notice>
          ) : null}

          {importFlow.importFileError ? <Notice tone="error">{importFlow.importFileError}</Notice> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Button onClick={() => navigate("/setup/create")}>
              <AddCircleIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              Create Vault
            </Button>
            <Button variant="secondary" onClick={() => navigate("/setup/import")}>
              <KeyRoundIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              Restore from seed
            </Button>
          </div>

          <div style={{ height: 1, background: "var(--color-border-subtle)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={importFlow.openFilePicker}>
              <FolderOpenIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              Import Vault file
            </Button>
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-compact)",
              lineHeight: "var(--leading-body)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            Keys stay encrypted on this device.
          </p>
        </div>
      </motion.div>

      <ImportVaultSheet flow={importFlow} />
    </FullPage>
  );
}
