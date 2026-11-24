import type { ReactNode } from "react";
import { AsciiBackdrop } from "@/components/ascii-backdrop";

/** Persistent shell header band with a drifting ASCII field behind its content. */
export function AsciiPageHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        height: "var(--height-header)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <AsciiBackdrop
        style={{ position: "absolute", inset: 0 }}
        contentStyle={{
          height: "100%",
          justifyContent: "center",
          padding: "0 var(--screen-padding)",
        }}
      >
        {children}
      </AsciiBackdrop>
    </div>
  );
}
