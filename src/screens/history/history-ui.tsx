import type { ReactNode } from "react";

export function StatusText({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color }}>
      {children}
    </div>
  );
}
