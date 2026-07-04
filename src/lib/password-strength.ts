export interface PasswordStrength {
  label: string;
  level: 0 | 1 | 2 | 3;
  color: string;
}

export function passwordStrength(pw: string): PasswordStrength {
  if (pw.length < 10) return { label: "Too short", level: 0, color: "var(--color-status-error)" };
  const score =
    (pw.length >= 14 ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  if (score <= 1) return { label: "Fair", level: 1, color: "var(--color-status-warning)" };
  if (score <= 2) return { label: "Good", level: 2, color: "var(--color-status-success)" };
  return { label: "Strong", level: 3, color: "var(--color-status-success)" };
}
