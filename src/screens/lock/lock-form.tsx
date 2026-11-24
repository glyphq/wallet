import type { ReactNode } from "react";
import type { UseFormHandleSubmit, UseFormRegister } from "react-hook-form";
import { LockKeyholeIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

export interface FormValues {
  password: string;
}

export function LockForm({
  register,
  handleSubmit,
  onSubmit,
  shakeKey,
  error,
  lockoutSecsLeft,
  loading,
  biometricEnabled,
  bioFailures,
  onBiometric,
  isLinux,
  secondaryAction,
}: {
  register: UseFormRegister<FormValues>;
  handleSubmit: UseFormHandleSubmit<FormValues>;
  onSubmit: (values: FormValues) => void;
  shakeKey: number;
  error: string;
  lockoutSecsLeft: number;
  loading: boolean;
  biometricEnabled: boolean;
  bioFailures: number;
  onBiometric: () => void;
  isLinux: boolean;
  secondaryAction?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", width: "100%" }}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div key={shakeKey} className={error ? "lock-shake" : undefined}>
          <Input
            {...register("password")}
            id="wallet-password"
            aria-label="Wallet password"
            type="password"
            leftElement={<LockKeyholeIcon size={18} strokeWidth={1.5} />}
            style={{ minHeight: 56, fontSize: "var(--text-section)", padding: "var(--space-4) 44px var(--space-4) 48px" }}
            placeholder="Enter the wallet password"
            autoComplete="current-password"
            error={lockoutSecsLeft > 0 ? `Locked. Try again in ${lockoutSecsLeft} seconds.` : error}
            disabled={lockoutSecsLeft > 0}
            autoFocus
          />
        </div>
        {secondaryAction}
        <Button type="submit" loading={loading} disabled={lockoutSecsLeft > 0}>
          <LockKeyholeIcon size={16} strokeWidth={1.5} aria-hidden="true" />
          {lockoutSecsLeft > 0 ? `Wait ${lockoutSecsLeft} seconds` : "Unlock wallet"}
        </Button>
      </form>

      {biometricEnabled && bioFailures < 3 ? (
        <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={onBiometric} disabled={loading}>
          <LockKeyholeIcon size={14} strokeWidth={1.5} />
          {isLinux ? "Quick unlock" : "Use biometrics"}
        </Button>
      ) : null}

      {biometricEnabled && bioFailures >= 3 ? (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            color: "var(--color-text-tertiary)",
            textAlign: "center",
          }}
        >
          {isLinux ? "Quick unlock" : "Biometric unlock"} unavailable for this session.
        </p>
      ) : null}
    </div>
  );
}
