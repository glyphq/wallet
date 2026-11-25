import { ArrowUpRight01Icon, Exchange01Icon, QrCodeIcon, SafeIcon } from "@/lib/icons";
import { Button } from "@/components/button";

export function PrimaryActions({ onSend, onReceive }: { onSend: () => void; onReceive: () => void }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
      <Button variant="primary" size="md" onClick={onSend}>
        <ArrowUpRight01Icon size={16} strokeWidth={2} />
        Send
      </Button>
      <Button variant="secondary" size="md" onClick={onReceive}>
        <QrCodeIcon size={16} strokeWidth={2} />
        Receive
      </Button>
    </div>
  );
}

export function MoreActions({ onSendMany, onMultisig }: { onSendMany: () => void; onMultisig: () => void }) {
  const linkStyle = {
    display: "inline-flex", alignItems: "center", gap: "var(--space-2)", border: 0,
    background: "transparent", padding: "var(--space-2)", color: "var(--color-text-secondary)",
    fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", cursor: "pointer",
  } as const;

  return (
    <nav aria-label="More wallet actions" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-4)", marginTop: "var(--space-5)" }}>
      <button type="button" onClick={onSendMany} style={linkStyle}>
        <Exchange01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
        Send to many
      </button>
      <button type="button" onClick={onMultisig} style={linkStyle}>
        <SafeIcon size={18} strokeWidth={1.5} aria-hidden="true" />
        Multisig
      </button>
    </nav>
  );
}
