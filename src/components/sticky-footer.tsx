import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useRequestFooter } from "@/screens/request/request-footer-context";

/** Pinned action area for request flows; rendered outside the scrolling content. */
export function StickyFooter({ children, notch }: { children: ReactNode; notch?: ReactNode }) {
  const target = useRequestFooter();
  const surface = (
    <div style={{ flexShrink: 0, background: "var(--color-bg-base)" }}>
      {notch ? (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: -1 }}>
          {notch}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--screen-padding)",
          borderTop: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-base)",
        }}
      >
        {children}
      </div>
    </div>
  );

  return target ? createPortal(surface, target) : surface;
}
