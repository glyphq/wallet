import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AltArrowLeft, AltArrowRight, Eye, EyeClosed, LockKeyhole, ShieldCheck } from "@solar-icons/react";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { Input } from "@/components/input";
import { StepProgress } from "@/components/step-progress";
import { stepMotion } from "@/lib/animations";
import { passwordStrength } from "@/lib/password-strength";

interface SetupFlowProps {
  current: number;
  total: number;
  title: ReactNode;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  onBack: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryActions?: ReactNode;
  error?: string;
}

export function SetupFlow({
  current,
  total,
  title,
  children,
  primaryLabel,
  onPrimary,
  onBack,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryActions,
  error,
}: SetupFlowProps) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 340,
        margin: "0 auto",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <StepProgress current={current} total={total} />
      <motion.div
        key={current}
        {...stepMotion}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
            paddingRight: "var(--space-1)",
          }}
        >
          <FlowHeader title={title} />
          {children}
          {error ? <SetupError>{error}</SetupError> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flexShrink: 0 }}>
          {secondaryActions}
          <Button onClick={onPrimary} disabled={primaryDisabled} loading={primaryLoading}>
            {primaryLabel}
            <AltArrowRight size={18} weight="Linear" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={onBack} disabled={primaryLoading}>
            <AltArrowLeft size={18} weight="Linear" aria-hidden="true" />
            Back
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function SetupError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-control)",
        background: "var(--color-status-error-soft)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-compact)",
        lineHeight: "var(--leading-body)",
        color: "var(--color-status-error)",
      }}
    >
      {children}
    </div>
  );
}

export function SeedSurface({
  seed,
  revealed = true,
}: {
  seed: string;
  revealed?: boolean;
}) {
  return (
    <div
      aria-label={revealed ? "Recovery seed" : "Recovery seed hidden"}
      style={{
        width: "100%",
        minHeight: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-control)",
        background: "var(--color-bg-surface-2)",
        overflow: "hidden",
      }}
    >
      <code
        aria-live="polite"
        style={{
          display: "block",
          maxWidth: "100%",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-compact)",
          letterSpacing: "0.035em",
          color: "var(--color-text-primary)",
          lineHeight: 1.7,
          overflowWrap: "anywhere",
          textAlign: "center",
          userSelect: revealed ? "text" : "none",
        }}
      >
        {revealed ? seed : "••••••••••••"}
      </code>
    </div>
  );
}

function PasswordVisibilityButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide passwords" : "Show passwords"}
      aria-pressed={visible}
      style={{
        width: 44,
        height: 44,
        marginRight: "calc(var(--space-3) * -1)",
        border: 0,
        background: "transparent",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
      }}
    >
      {visible ? <EyeClosed size={18} weight="Linear" aria-hidden="true" /> : <Eye size={18} weight="Linear" aria-hidden="true" />}
    </button>
  );
}

export function PasswordFields({
  password,
  confirmPassword,
  visible,
  onPasswordChange,
  onConfirmChange,
  onToggleVisibility,
  onSubmit,
}: {
  password: string;
  confirmPassword: string;
  visible: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onToggleVisibility: () => void;
  onSubmit: () => void;
}) {
  const strength = passwordStrength(password);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Input
        label="Password"
        leftElement={<LockKeyhole size={18} weight="Linear" />}
        type={visible ? "text" : "password"}
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onSubmit()}
        placeholder="At least 10 characters"
        autoComplete="new-password"
        autoFocus
        rightElement={<PasswordVisibilityButton visible={visible} onToggle={onToggleVisibility} />}
      />
      <Input
        label="Confirm password"
        leftElement={<ShieldCheck size={18} weight="Linear" />}
        type={visible ? "text" : "password"}
        value={confirmPassword}
        onChange={(event) => onConfirmChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onSubmit()}
        placeholder="Enter it again"
        autoComplete="new-password"
        error={mismatch ? "Passwords do not match" : undefined}
      />
      {password ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }} aria-label={`Password strength: ${strength.label}`}>
          <div style={{ display: "flex", gap: "var(--space-1)", flex: 1 }} aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 999,
                  background: index <= strength.level ? "var(--color-text-secondary)" : "var(--color-border-default)",
                }}
              />
            ))}
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            {strength.label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function passwordsAreValid(password: string, confirmation: string) {
  const strength = passwordStrength(password);
  return password.length >= 10 && strength.level >= 1 && confirmation.length > 0 && password === confirmation;
}
