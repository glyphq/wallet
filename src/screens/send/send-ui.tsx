export const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function Numpad({ onPress, onMax }: { onPress: (key: string) => void; onMax?: () => void }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "var(--space-1)",
      maxWidth: 320,
      width: "100%",
      margin: "0 auto",
    }}>
      {PAD_KEYS.map((key, i) => {
        const isMaxSlot = i === 9;
        const label = isMaxSlot ? "MAX" : key;
        const isActive = !!key || isMaxSlot;
        return (
          <button
            key={i}
            type="button"
            disabled={!isActive}
            onClick={() => {
              if (isMaxSlot) onMax?.();
              else if (key) onPress(key);
            }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 58,
              background: "transparent",
              border: "none",
              cursor: isActive ? "pointer" : "default",
              fontFamily: "var(--font-sans)",
              fontSize: isMaxSlot ? "var(--text-label)" : "1.375rem",
              fontWeight: isMaxSlot ? 500 : 400,
              color: isMaxSlot ? "var(--color-accent)" : key === "⌫" ? "var(--color-text-secondary)" : "var(--color-text-display)",
              borderRadius: "var(--radius-card)",
              transition: "transform 0.08s, background 0.08s",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
            }}
            onPointerDown={(e) => {
              if (!isActive) return;
              e.currentTarget.style.background = "var(--color-bg-hover)";
              e.currentTarget.style.transform = "scale(0.95)";
            }}
            onPointerUp={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; }}
            onPointerLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "scale(1)"; }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
