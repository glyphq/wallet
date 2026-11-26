import { useNavigate } from "react-router";
import { ArrowLeft01Icon, KeyRoundIcon, WalletAdd01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { PageBanner, PageFrame } from "@/components/page-header";
import { LandscapeOnboarding } from "@/layouts/landscape-onboarding";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { ImportWalletStep } from "./welcome/import-wallet-step";
import { Notice } from "./welcome/notice";
import { useWalletFileImport } from "./welcome/use-wallet-file-import";
import { WalletFileDrop } from "./welcome/wallet-file-drop";

const actionsStyle = { display: "flex", flexDirection: "column" as const, gap: "var(--space-3)" };

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const hasWallets = usePersistedStore((s) => s.wallets.length > 0);
  const isLocked = useSessionStore((s) => s.isLocked);
  const hasPendingRequest = useSessionStore((s) => s.pendingRequests.length > 0);
  const importFlow = useWalletFileImport();

  if (importFlow.importData) return <ImportWalletStep flow={importFlow} />;

  return (
    <LandscapeOnboarding>
      <PageBanner
        title="Set up your wallet"
        description="Set up a new wallet, restore a seed, or import an existing wallet backup."
      />

      <PageFrame
        actions={(
          <div style={actionsStyle}>
            <Button onClick={() => navigate("/setup/create")}>
              <WalletAdd01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              New wallet
            </Button>
            <Button variant="secondary" onClick={() => navigate("/setup/import")}>
              <KeyRoundIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              Restore from seed
            </Button>
            {hasWallets ? (
              <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => navigate(isLocked ? "/lock" : "/dashboard")}>
                <ArrowLeft01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                Back to wallet
              </Button>
            ) : null}
          </div>
        )}
      >
        <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)", textAlign: "center" }}>
          <WalletFileDrop flow={importFlow} />

          {hasPendingRequest ? <Notice tone="warning">A request is waiting.</Notice> : null}
          {importFlow.importFileError ? <Notice tone="error">{importFlow.importFileError}</Notice> : null}
        </div>
      </PageFrame>

    </LandscapeOnboarding>
  );
}
