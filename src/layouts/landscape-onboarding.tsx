import type { ReactNode } from "react";

/** Full-height page shell used by header-led onboarding screens. */
export function LandscapeOnboarding({ children }: { children: ReactNode }) {
  return <div className="page-shell">{children}</div>;
}
