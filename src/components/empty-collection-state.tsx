import { Exchange01Icon, Search01Icon } from "@/lib/icons";

/** Shared empty state for activity and search collections. */
export function EmptyCollectionState({
  title,
  description,
  icon = "activity",
}: {
  title: string;
  description: string;
  icon?: "activity" | "search";
}) {
  const Icon = icon === "search" ? Search01Icon : Exchange01Icon;

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
      <Icon
        size={28}
        strokeWidth={1.5}
        aria-hidden="true"
        style={{ color: "var(--color-text-tertiary)" }}
      />
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
