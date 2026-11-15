import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SeedSurface } from "@/components/setup-flow";
import { Sheet } from "@/components/sheet";
import { Textarea } from "@/components/textarea";
import { ViewIcon, ViewOffIcon } from "@/lib/icons";
import type { AccountMeta } from "@/store/persisted";

interface SeedRevealSheetProps {
  account: AccountMeta | null;
  onClose: () => void;
  verifyingBackup: boolean;
  biometricRevealRequired: boolean;
  revealedSeed: string;
  seedVisible: boolean;
  onToggleSeedVisible: () => void;
  seedCopied: boolean;
  seedSecsLeft: number;
  onCopy: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
  onReveal: () => void;
  backupCheck: string;
  onBackupCheckChange: (value: string) => void;
  backupCheckStatus: "idle" | "match" | "mismatch";
  onVerify: () => void;
}

export function SeedRevealSheet({
  account,
  onClose,
  verifyingBackup,
  biometricRevealRequired,
  revealedSeed,
  seedVisible,
  onToggleSeedVisible,
  seedCopied,
  seedSecsLeft,
  onCopy,
  password,
  onPasswordChange,
  error,
  loading,
  onReveal,
  backupCheck,
  onBackupCheckChange,
  backupCheckStatus,
  onVerify,
}: SeedRevealSheetProps) {
  return (
    <Sheet open={!!account} onClose={onClose} title={verifyingBackup ? "Verify seed backup" : account ? `Reveal seed for ${account.name}` : "Reveal seed"}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {!revealedSeed ? (
          <>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
              {verifyingBackup
                ? "Unlock once, then type your saved seed to confirm the backup."
                : biometricRevealRequired
                  ? "Use biometric unlock to reveal this account seed."
                  : "Enter the vault password to decrypt this account seed."}
            </div>
            {!biometricRevealRequired && (
              <Input
                type="password"
                label="Vault password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && onReveal()}
                error={error}
                placeholder="••••••••••"
                autoComplete="current-password"
                autoFocus
              />
            )}
            {biometricRevealRequired && error && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
                [{error}]
              </div>
            )}
            <Button onClick={onReveal} loading={loading} disabled={!biometricRevealRequired && !password}>
              {biometricRevealRequired ? "Use biometric" : verifyingBackup ? "Unlock seed" : "Reveal seed"}
            </Button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
              {seedVisible ? "Shown" : "Hidden"}. Closes in {seedSecsLeft}s.
            </div>
            <SeedSurface seed={revealedSeed} revealed={seedVisible} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Button variant="secondary" shape="sharp" onClick={onCopy}>
                {seedCopied ? "Copied" : "Copy seed"}
              </Button>
              <Button variant="secondary" shape="sharp" onClick={onToggleSeedVisible} aria-pressed={seedVisible}>
                {seedVisible ? <ViewOffIcon size={18} strokeWidth={1.5} aria-hidden="true" /> : <ViewIcon size={18} strokeWidth={1.5} aria-hidden="true" />}
                {seedVisible ? "Hide" : "Reveal"}
              </Button>
            </div>
            {verifyingBackup ? (
              <>
                <Textarea
                  value={backupCheck}
                  onChange={(event) => onBackupCheckChange(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") onVerify();
                  }}
                  placeholder="Type your saved seed"
                  aria-label="Saved seed"
                  technical
                  style={{ resize: "none", minHeight: 112, borderRadius: "var(--radius-control)", background: "var(--color-bg-input)", overflowWrap: "anywhere" }}
                />
                {backupCheckStatus !== "idle" ? (
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: backupCheckStatus === "match" ? "var(--color-status-success)" : "var(--color-status-error)" }}>
                    {backupCheckStatus === "match" ? "Backup verified" : "Seed does not match"}
                  </div>
                ) : null}
                <Button onClick={onVerify} disabled={!backupCheck.trim()}>Verify backup</Button>
              </>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}
