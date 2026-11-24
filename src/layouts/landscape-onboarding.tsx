import type { ReactNode } from "react";

/** Full-width page shell for onboarding and future header-led screens. */
export function LandscapeOnboarding({ children }: { children: ReactNode }) {
  return <div className="onboarding-page">{children}</div>;
}
