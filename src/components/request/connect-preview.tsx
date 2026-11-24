import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { truncateId } from "@/lib/format";
import { RequestApprovalActions } from "./request-primitives";
import type { ConnectRequest, GlyphPermission } from "@/lib/request-schema";
import type { ConnectApproveResult } from "@/lib/request-approvals";
import { Link01Icon } from "@/lib/icons";
import { MarbleAvatar } from "@/components/marble-avatar";
import { DropdownSelect } from "@/components/dropdown-select";
import { FieldLabel } from "@/components/field-parts";
import { Toggle } from "@/components/toggle";
import { DappPolicyControls } from "@/components/dapp-policy-controls";
import { DAPP_PERMISSION_LABELS, DEFAULT_DAPP_EXPIRY_DURATION_MS, makeDappExpiresAt, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";

export type { ConnectRequest } from "@/lib/request-schema";

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  transfer: "Send QU from the connected account",
  sc_call: "Call contracts from the connected account",
  sign_message: "Sign messages with the connected account",
};

interface ConnectPreviewProps {
  request: ConnectRequest;
  onApprove: (result: ConnectApproveResult) => void;
  onReject: () => void;
}

export function ConnectPreview({ request, onApprove, onReject }: ConnectPreviewProps) {
  const accounts = useSessionStore((s) => s.accounts);
  const settings = usePersistedStore((s) => s.settings);

  const [selectedIndex, setSelectedIndex] = useState(settings.activeAccountIndex);

  const requestedPerms = request.permissions ?? [];
  const [grantedPerms, setGrantedPerms] = useState<Set<string>>(() => new Set(requestedPerms));
  const [transferLimitQu, setTransferLimitQu] = useState("");
  const [expiryDurationMs, setExpiryDurationMs] = useState<number | undefined>(DEFAULT_DAPP_EXPIRY_DURATION_MS);

  const selectedAccount = accounts[selectedIndex] ?? null;

  useEffect(() => {
    if (accounts.length > 0 && !accounts[selectedIndex]) setSelectedIndex(0);
  }, [accounts, selectedIndex]);

  function togglePerm(p: string) {
    setGrantedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function approve() {
    if (!selectedAccount) return;
    const permissions = requestedPerms.filter((p) => grantedPerms.has(p)) as GlyphPermission[];
    const sanitizedLimit = sanitizeTransferLimitQu(transferLimitQu);
    onApprove({
      identity: selectedAccount.identity,
      accountIndex: selectedIndex,
      permissions,
      transferLimitQu: sanitizedLimit,
      expiryDurationMs,
      expiresAt: makeDappExpiresAt(expiryDurationMs),
    });
  }

  const grantsTransferLike = requestedPerms.some((p) => (p === "transfer" || p === "sc_call") && grantedPerms.has(p));

  const accountOptions = accounts.map((sessionAccount, index) => ({
    value: String(index),
    label: truncateId(sessionAccount.identity, 8, 8),
    icon: <MarbleAvatar seed={sessionAccount.identity} size={22} />,
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

      <div>
        <FieldLabel>Permissions</FieldLabel>
        <div style={{ marginTop: "var(--space-2)" }}>
          {requestedPerms.length > 0 ? requestedPerms.map((permission) => (
            <Toggle
              key={permission}
              label={DAPP_PERMISSION_LABELS[permission] ?? permission}
              description={PERMISSION_DESCRIPTIONS[permission]}
              checked={grantedPerms.has(permission)}
              onChange={() => togglePerm(permission)}
            />
          )) : (
            <p style={{ margin: "var(--space-3) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
              No permissions requested. This only shares your selected account address.
            </p>
          )}
        </div>
      </div>

      <div>
        <FieldLabel>Access</FieldLabel>
        <div style={{ marginTop: "var(--space-2)" }}>
          <DappPolicyControls
            transferLimitQu={transferLimitQu}
            expiryDurationMs={expiryDurationMs}
            onTransferLimitChange={setTransferLimitQu}
            onExpiryDurationChange={setExpiryDurationMs}
            showLimit={grantsTransferLike}
            idPrefix="connect-dapp-policy"
          />
        </div>
      </div>

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
