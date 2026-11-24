import type { ReactNode } from "react";
import { AsciiBackdrop } from "@/components/ascii-backdrop";

/** Centered onboarding frame; the ASCII field stays inside the bordered inner surface. */
export function LandscapeOnboarding({ children }: { children: ReactNode }) {
  return (
    <div className="onboarding-landscape">
      <div className="onboarding-inner">
        <AsciiBackdrop
          contentStyle={{
            padding: "clamp(28px, 4vw, 56px)",
            justifyContent: "center",
            gap: "var(--space-8)",
          }}
        >
          {children}
        </AsciiBackdrop>
      </div>
    </div>
  );
}
