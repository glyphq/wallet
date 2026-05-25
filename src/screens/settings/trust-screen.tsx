import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "var(--space-4)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
        {title}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
        {body}
      </div>
    </div>
  );
}

export default function TrustScreen() {
  const navigate = useNavigate();
  const statusBar = <ScreenHeader title="Trust" onBack={() => navigate("/settings")} />;

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <TrustCard
        title="Current request identity model"
        body="Deep-link requests still rely on self-reported dApp name and origin. Sigil treats them as unverified and shows warnings by default."
      />
      <TrustCard
        title="Signed request envelope roadmap"
        body="Planned next step: require a signed envelope over request fields, callback URL, expiry, and declared origin so metadata becomes tamper-evident."
      />
      <TrustCard
        title="Verified dApp registry roadmap"
        body="Planned follow-up: optional registry-backed verification for known apps, including issuer keys, revocation, and clearer trust labels in approval screens."
      />
      <TrustCard
        title="Export format"
        body="Vault and contact exports now use signed metadata format v2. Legacy v1 imports remain supported and are labeled during import."
      />
    </AppShell>
  );
}
