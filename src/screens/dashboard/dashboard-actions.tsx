import { ArrowUpRight01Icon, QrCodeIcon } from "@/lib/icons";
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
