import type { ReactNode } from "react";
import { AsciiBackdrop } from "@/components/ascii-backdrop";

/** Centered onboarding surface over a full-window ASCII field. */
export function LandscapeOnboarding({ children }: { children: ReactNode }) {
  return (
    <div className="onboarding-landscape">
      <AsciiBackdrop />
      <div className="onboarding-inner">{children}</div>
    </div>
  );
}
