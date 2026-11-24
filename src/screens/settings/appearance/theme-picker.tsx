import { CheckmarkCircle01Icon, Moon02Icon, Sun01Icon } from "@/lib/icons";
import type { ThemeMode } from "@/store/persisted";

const THEMES: { id: ThemeMode; label: string; description: string; Icon: typeof Sun01Icon }[] = [
  { id: "dark", label: "Dark", description: "Low-glare colors for focused, comfortable viewing.", Icon: Moon02Icon },
  { id: "light", label: "Light", description: "A crisp, bright palette for daylight and bright rooms.", Icon: Sun01Icon },
];

export function ThemePicker({ value, onChange }: { value: ThemeMode; onChange: (theme: ThemeMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {THEMES.map(({ id, label, description, Icon }) => {
        const selected = value === id;
        return (
          <div key={id}>
            <button
              type="button"
              className="settings-choice"
              data-selected={selected ? "true" : "false"}
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              style={{ fontWeight: selected ? 600 : 400 }}
            >
              <span style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <span>{label}</span>
                  <span style={{ maxWidth: "75%", fontSize: "var(--text-caption)", fontWeight: 400, color: "var(--color-text-tertiary)", lineHeight: "var(--leading-compact)" }}>
                    {description}
                  </span>
                </span>
              </span>
              {selected ? <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} /> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
