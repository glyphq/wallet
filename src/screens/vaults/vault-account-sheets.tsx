import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import type { AccountMeta } from "@/store/persisted";

const ACCOUNT_NAME_SUGGESTIONS = [
  "Main", "Trading", "Staking", "Cold Storage", "DeFi", "Savings",
  "Hot Wallet", "Treasury", "Operations", "Rewards",
];

interface AddAccountSheetProps {
  open: boolean;
  onClose: () => void;
  accounts: AccountMeta[];
  mode: "new" | "import";
  setMode: (mode: "new" | "import") => void;
  name: string;
  setName: (value: string) => void;
  seed: string;
  setSeed: (value: string) => void;
  seedError: string;
  setSeedError: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  setError: (value: string) => void;
  loading: boolean;
  onAdd: () => void;
}

export function AddAccountSheet({
  open,
  onClose,
  accounts,
  mode,
  setMode,
  name,
  setName,
  seed,
  setSeed,
  seedError,
  setSeedError,
  password,
  setPassword,
  error,
  setError,
  loading,
  onAdd,
}: AddAccountSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Add account">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {(["new", "import"] as const).map((nextMode, i) => (
              <div key={nextMode} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                {i > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>/</span>}
                <button
                  type="button"
                  onClick={() => { setMode(nextMode); setSeed(""); setSeedError(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", padding: 0, color: mode === nextMode ? "var(--color-text-display)" : "var(--color-text-disabled)" }}
                >
                  {nextMode === "new" ? "New seed" : "Import seed"}
                </button>
              </div>
            ))}
        </div>
        <div>
          <Input label="Account name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DeFi, Staking" autoFocus style={{ fontFamily: "var(--font-sans)" }} />
          {(() => {
            const existing = new Set(accounts.map((account) => account.name.toLowerCase()));
            const q = name.toLowerCase();
            const suggestions = ACCOUNT_NAME_SUGGESTIONS.filter(
              (s) => !existing.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)),
            ).slice(0, 4);
            if (!suggestions.length) return null;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setName(s)}
                    style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: "2px var(--space-2)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
        {mode === "import" && (
          <Input
            label="Seed (55 lowercase letters)"
            type="password"
            value={seed}
            onChange={(e) => { setSeed(e.target.value); if (seedError) setSeedError(""); }}
            error={seedError}
            placeholder="55 characters, lowercase"
            autoComplete="off"
          />
        )}
        <Input type="password" label="Vault password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && !loading && onAdd()} error={error} placeholder="••••••••••" autoComplete="current-password" />
        <Button onClick={onAdd} loading={loading} disabled={!name.trim() || !password || (mode === "import" && !seed.trim())}>Add account</Button>
        <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

interface RenameAccountSheetProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

export function RenameAccountSheet({ open, onClose, value, onChange, onSave }: RenameAccountSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Rename account">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input label="Name" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSave()} autoFocus style={{ fontFamily: "var(--font-sans)" }} />
        <Button onClick={onSave} disabled={!value.trim()}>Save</Button>
      </div>
    </Sheet>
  );
}

interface AccountMetaSheetProps {
  open: boolean;
  onClose: () => void;
  tags: string;
  setTags: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  onSave: () => void;
}

export function AccountMetaSheet({ open, onClose, tags, setTags, note, setNote, onSave }: AccountMetaSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Notes and tags">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          label="Tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="staking, cold, treasury"
        />
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            Note
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Optional note for this account"
            style={{
              width: "100%",
              resize: "vertical",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-primary)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-sharp)",
              padding: "var(--space-3)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
            }}
          />
        </label>
        <Button onClick={onSave}>Save</Button>
      </div>
    </Sheet>
  );
}

interface HideAccountSheetProps {
  account: AccountMeta | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function HideAccountSheet({ account, onClose, onConfirm }: HideAccountSheetProps) {
  return (
    <Sheet open={!!account} onClose={onClose} title={account ? `Hide ${account.name}?` : "Hide account"}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
          The account will be removed from the switcher. It can be restored from this screen.
        </div>
        <Button onClick={onConfirm}>Hide account</Button>
      </div>
    </Sheet>
  );
}

interface RemoveAccountSheetProps {
  account: AccountMeta | null;
  onClose: () => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  setError: (value: string) => void;
  loading: boolean;
  onRemove: () => void;
}

export function RemoveAccountSheet({ account, onClose, password, setPassword, error, setError, loading, onRemove }: RemoveAccountSheetProps) {
  return (
    <Sheet open={!!account} onClose={onClose} title={account ? `Remove ${account.name}?` : "Remove account"}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-error)" }}>This cannot be undone.</div>
        <Input type="password" label="Vault password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && onRemove()} error={error} placeholder="••••••••••" autoComplete="current-password" autoFocus />
        <Button variant="danger" shape="sharp" onClick={onRemove} loading={loading} disabled={!password}>Remove account</Button>
      </div>
    </Sheet>
  );
}
