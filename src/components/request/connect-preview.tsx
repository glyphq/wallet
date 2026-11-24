import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { truncateId } from "@/lib/format";
import { RequestApprovalActions } from "./request-primitives";
import type { ConnectRequest } from "@/lib/request-schema";
import type { ConnectApproveResult } from "@/lib/request-approvals";
import { Link01Icon } from "@/lib/icons";
import { DropdownSelect } from "@/components/dropdown-select";
import { FramedAvatar } from "@/components/framed-avatar";

export type { ConnectRequest } from "@/lib/request-schema";

interface ConnectPreviewProps {
  request: ConnectRequest;
  onApprove: (result: ConnectApproveResult) => void;
  onReject: () => void;
}

export function ConnectPreview({ request, onApprove, onReject }: ConnectPreviewProps) {
  const accounts = useSessionStore((s) => s.accounts);
  const settings = usePersistedStore((s) => s.settings);
  const [selectedIndex, setSelectedIndex] = useState(settings.activeAccountIndex);
  const selectedAccount = accounts[selectedIndex] ?? null;

  useEffect(() => {
    if (accounts.length > 0 && !accounts[selectedIndex]) setSelectedIndex(0);
  }, [accounts, selectedIndex]);

  function approve() {
    if (!selectedAccount) return;
    onApprove({ identity: selectedAccount.identity, accountIndex: selectedIndex, permissions: request.permissions ?? [] });
  }

  const accountOptions = accounts.map((sessionAccount, index) => ({
    value: String(index),
    label: truncateId(sessionAccount.identity, 8, 8),
    icon: <FramedAvatar seed={sessionAccount.identity} size={28} />,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: 0 }}>
      <DropdownSelect
        id="connect-account"
        label="Account"
        value={String(selectedIndex)}
        options={accountOptions}
        onChange={(value) => setSelectedIndex(Number(value))}
      />

      <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
        Only this address is shared. Every transaction and signature is reviewed separately.
      </p>

      <RequestApprovalActions
        onReject={onReject}
        onApprove={approve}
        approveLabel="Connect"
        approveIcon={<Link01Icon size={16} aria-hidden="true" />}
        approveDisabled={!selectedAccount}
      />
    </div>
  );
}
