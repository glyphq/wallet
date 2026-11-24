import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowLeft01Icon, ArrowRight01Icon, ViewIcon, ViewOffIcon, LockKeyholeIcon, ShieldCheckIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { PageBanner, PageFrame } from "@/components/page-header";
import { LandscapeOnboarding } from "@/layouts/landscape-onboarding";
import { stepMotion } from "@/lib/animations";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/password-strength";

interface SetupFlowProps {
  title: ReactNode;
  description?: ReactNode;
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
  title,
  description,
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
    <LandscapeOnboarding>
      <PageBanner title={title} description={description} />
      <PageFrame
        actions={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {secondaryActions}
            <Button onClick={onPrimary} disabled={primaryDisabled} loading={primaryLoading}>
              {primaryLabel}
              <ArrowRight01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={onBack} disabled={primaryLoading}>
              <ArrowLeft01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              Back
            </Button>
          </div>
        )}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            margin: "0 auto",
            height: "100%",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          <motion.div
            {...stepMotion}
            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-5)",
                paddingRight: "var(--space-1)",
              }}
            >
              {children}
              {error ? <SetupError>{error}</SetupError> : null}
            </div>
          </motion.div>
        </div>
      </PageFrame>
    </LandscapeOnboarding>
  );
}

function SetupError({ children }: { children: ReactNode }) {
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

const MASK_CHARS = "/\\|-_=+<>*#%&@$";

function asciiSeedMask(seed: string): string {
  const length = seed.length || 55;
  return Array.from({ length }, (_, index) => MASK_CHARS[index % MASK_CHARS.length]).join("");
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
      className="seed-surface corner-frame"
      aria-label={revealed ? "Recovery seed" : "Recovery seed hidden"}
      style={{
        width: "100%",
        minHeight: 96,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-4)",
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
        {revealed ? seed : asciiSeedMask(seed)}
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
      {visible ? <ViewOffIcon size={18} strokeWidth={1.5} aria-hidden="true" /> : <ViewIcon size={18} strokeWidth={1.5} aria-hidden="true" />}
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
        leftElement={<LockKeyholeIcon size={18} strokeWidth={1.5} />}
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
        leftElement={<ShieldCheckIcon size={18} strokeWidth={1.5} />}
        type={visible ? "text" : "password"}
        value={confirmPassword}
        onChange={(event) => onConfirmChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onSubmit()}
        placeholder="Enter it again"
        autoComplete="new-password"
        error={mismatch ? "Passwords do not match" : undefined}
      />
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={strength.level}
        aria-label={`Password strength: ${strength.label}`}
        style={{ display: "flex", gap: "var(--space-1)" }}
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: password.length > 0 && index <= strength.level ? strength.color : "var(--color-border-default)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function passwordsAreValid(password: string, confirmation: string) {
  const strength = passwordStrength(password);
  return password.length >= MIN_PASSWORD_LENGTH && strength.level >= 1 && confirmation.length > 0 && password === confirmation;
}
