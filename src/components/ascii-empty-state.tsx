const ACTIVITY_ICON = [
  "  +---------------+",
  "  |  <-       ->  |",
  "  |      ..       |",
  "  |  ->       <-  |",
  "  +---------------+",
].join("\n");

const SEARCH_ICON = [
  "   .-------.",
  "  /         \\",
  " |   /---\\   |",
  "  \\  \\___/  /",
  "   '-------'",
  "       |",
  "       '",
].join("\n");

/** Static ASCII illustration for empty collections. */
export function AsciiEmptyState({
  title,
  description,
  icon = "activity",
}: {
  title: string;
  description: string;
  icon?: "activity" | "search";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-8) var(--space-4)",
        textAlign: "center",
      }}
    >
      <pre
        aria-hidden="true"
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          lineHeight: 1.35,
          color: "var(--color-text-tertiary)",
          opacity: 0.7,
          userSelect: "none",
        }}
      >
        {icon === "search" ? SEARCH_ICON : ACTIVITY_ICON}
      </pre>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-compact)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </span>
        <span
          style={{
            maxWidth: 280,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-body)",
            color: "var(--color-text-tertiary)",
          }}
        >
          {description}
        </span>
      </div>
    </div>
  );
}
