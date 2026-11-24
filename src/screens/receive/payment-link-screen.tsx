import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { copyToClipboard } from "@/lib/clipboard";
import { AppShell } from "@/layouts/app-shell";
import { Input } from "@/components/input";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { buildLinks, eyebrowStyle, sectionStyle, type PaymentLinkMode } from "./payment-link-utils";
import { PaymentLinkAccountOptions } from "./payment-link-account-options";
import { PaymentLinkPreview } from "./payment-link-preview";
import { PaymentLinkCopyActions } from "./payment-link-copy-actions";
import { PaymentLinkUnavailable } from "./payment-link-unavailable";

export default function PaymentLinkScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const wallet = usePersistedStore((s) =>
    s.wallets.find((v) => v.id === s.settings.activeWalletId),
  );
  const accounts = useSessionStore((s) => s.accounts);

  const defaultIdentity =
    getWalletAccountIdentity(wallet ?? null, settings.activeAccountIndex, accounts) ?? "";

  const [to, setTo] = useState(defaultIdentity);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [copiedDeep, setCopiedDeep] = useState(false);
  const [qrMode, setQrMode] = useState<PaymentLinkMode>("web");

  const links = useMemo(() => {
    if (!to.trim() || to.trim().length !== 60) return null;
    try {
      return buildLinks(to.trim().toUpperCase(), amount, label);
    } catch {
      return null;
    }
  }, [to, amount, label]);

  async function copy(text: string, which: "web" | "deep") {
    await copyToClipboard(text);
    if (which === "web") {
      setCopiedWeb(true);
      setTimeout(() => setCopiedWeb(false), 1500);
    } else {
      setCopiedDeep(true);
      setTimeout(() => setCopiedDeep(false), 1500);
    }
  }

  // Account selector — all visible accounts across the wallet
  const accountOptions = useMemo(() => {
    if (!wallet) return [];
    return wallet.accounts
      .filter((a) => !a.hidden)
      .map((a) => ({
        name: a.name,
        identity: getWalletAccountIdentity(wallet, a.index, accounts) ?? "",
      }))
      .filter((a) => a.identity.length === 60);
  }, [wallet, accounts]);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-5)" }}>
        <section aria-labelledby="payment-link-intro">
          <h2
            id="payment-link-intro"
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-title)",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Create a payment link
          </h2>
          <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body)", lineHeight: 1.45 }}>
            Share a web link or app link that resolves to your visible receiving identity.
          </p>
        </section>

        <PaymentLinkAccountOptions
          accounts={accountOptions}
          selectedIdentity={to}
          onSelect={setTo}
        />

        <section aria-labelledby="payment-details-heading" style={sectionStyle}>
          <span id="payment-details-heading" style={eyebrowStyle}>Optional details</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Input
              label="Amount (QU)"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="Leave blank to let sender choose"
              inputMode="numeric"
              autoComplete="off"
            />
            <Input
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 100))}
              placeholder="e.g. Coffee, Invoice #42"
              autoComplete="off"
            />
          </div>
        </section>

        {links ? (
          <>
            <PaymentLinkPreview links={links} mode={qrMode} onModeChange={setQrMode} />

            <PaymentLinkCopyActions
              copiedWeb={copiedWeb}
              copiedDeep={copiedDeep}
              onCopyWeb={() => copy(links.web, "web")}
              onCopyDeep={() => copy(links.deep, "deep")}
            />

            <section aria-labelledby="receive-identity-heading" style={sectionStyle}>
              <span id="receive-identity-heading" style={eyebrowStyle}>Receiving address</span>
              <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", lineHeight: 1.5, wordBreak: "break-all" }}>
                {to.trim().toUpperCase()}
              </p>
            </section>
          </>
        ) : (
          <PaymentLinkUnavailable />
        )}
      </motion.div>
    </AppShell>
  );
}
