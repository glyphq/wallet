import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { SECTION_ICONS, SECTION_LABELS, type SearchResult, type SearchSection } from "./search-results";

export function SearchResults({ grouped }: { grouped: Record<SearchSection, SearchResult[]> }) {
  return (
    <>
      {(Object.entries(grouped) as Array<[SearchSection, SearchResult[]]>).map(([section, sectionResults]) => (
        sectionResults.length > 0 ? (
          <div key={section} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-disabled)" }}>
              <span style={{ flexShrink: 0 }}>{SECTION_ICONS[section]}</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500 }}>
                {SECTION_LABELS[section]}
              </span>
            </div>
            {sectionResults.map((result, index) => (
              <div key={result.key}>
                {index > 0 && <Divider style={{ marginBottom: "var(--space-3)" }} />}
                <button
                  type="button"
                  onClick={result.onSelect}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: "var(--space-3)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
                >
                  <Identicon kind={result.badgeKind ?? "identity"} code={result.badgeCode} icon={result.badgeIcon} seed={result.identity ?? result.key} label={result.title} size={32} radius={8} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                      {result.title}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                      {result.subtitle}
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        ) : null
      ))}
    </>
  );
}
