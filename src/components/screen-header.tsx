import type { ReactNode } from "react";
import { AltArrowLeft } from "@solar-icons/react";
import { IconButton } from "@/components/icon-button";

export interface ScreenHeaderProps {
  title: ReactNode;
  leading?: ReactNode;
  onBack?: () => void;
  backAriaLabel?: string;
  action?: ReactNode;
}

export function ScreenHeader({ title, leading, onBack, backAriaLabel, action }: ScreenHeaderProps) {
  // When a leading element is provided (e.g. shell identicon), render the
  // title inline next to it.  When only onBack is provided, keep the
  // original centered title layout.
  if (leading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          width: "100%",
          minHeight: 52,
        }}
      >
        <div style={{ flexShrink: 0 }}>{leading}</div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-section)",
            lineHeight: "var(--leading-tight)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
        <div style={{ flex: 1 }} />
        {action ? (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            {action}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 52,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 52 }}>
        {onBack ? (
          <IconButton label={backAriaLabel ?? "Go back"} onClick={onBack} style={{ flexShrink: 0 }}>
            <AltArrowLeft size={22} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      <div style={{ minWidth: 0, display: "flex", justifyContent: "center" }}>
        <h1
          style={{
            margin: 0,
            maxWidth: "100%",
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-section)",
            lineHeight: "var(--leading-tight)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textAlign: "center",
          }}
        >
          {title}
        </h1>
      </div>

      <div
        style={{
          minHeight: 40,
          minWidth: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "var(--space-1)",
        }}
      >
        {action ?? null}
      </div>
    </div>
  );
}
