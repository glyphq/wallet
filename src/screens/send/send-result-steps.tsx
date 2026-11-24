import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { RefreshIcon, ShieldAlertIcon } from "@/lib/icons";
import { useHideAppChrome } from "@/layouts/chrome-visibility";
import { SendStepPanel } from "./send-step-panel";
import { SendStepFooter } from "./send-ui";

export interface SendErrorStepProps {
  txError: string;
  onRetry: () => void;
}

/** Send broadcast-failure step. */
export function SendErrorStep({ txError, onRetry }: SendErrorStepProps) {
  useHideAppChrome();
  const navigate = useNavigate();
  return (
    <SendStepPanel scroll="y" gap="var(--space-5)" role="alert">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
          <ShieldAlertIcon size={20} style={{ color: "var(--color-status-error)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-display)" }}>
              Broadcast failed
            </div>
            <p style={{ margin: "var(--space-2) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", lineHeight: "var(--leading-body)" }}>
              {txError || "The transaction could not be broadcast."}
            </p>
          </div>
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-tertiary)", lineHeight: "var(--leading-body)" }}>
          Your draft was kept so you can review and try again.
        </p>
      </div>

      <SendStepFooter>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Button onClick={onRetry}>
            <RefreshIcon size={16} aria-hidden="true" />
            Review and try again
          </Button>
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            Cancel
          </Button>
        </div>
      </SendStepFooter>
    </SendStepPanel>
  );
}
