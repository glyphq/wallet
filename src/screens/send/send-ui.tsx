import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { AddressSuggestions } from "@/components/address-suggestions";
import type { AddressSuggestion } from "@/lib/address-intelligence";
import { gesture } from "@/lib/animations";

export const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
  color: "var(--color-text-secondary)",
};

/** Bordered section used for review / receipt row groups. */
export const rowGroupStyle: CSSProperties = {
  borderTop: "1px solid var(--color-border-subtle)",
  borderBottom: "1px solid var(--color-border-subtle)",
};

/** One-pixel rule between rows inside a bordered section. */
export const thinDividerStyle: CSSProperties = {
  height: 1,
  background: "var(--color-border-subtle)",
};

/** Uppercase label above a review group. */
export const reviewSectionLabelStyle: CSSProperties = {
  ...labelStyle,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "var(--text-caption)",
};

/** Secondary explanatory copy used by status panels. */
export const statusCopyStyle: CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: 1.45,
  color: "var(--color-text-secondary)",
};

/** Muted text action used for Cancel / Edit / View history. */
export const ghostActionStyle: CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
  color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center",
};

export function GhostActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <motion.button {...gesture.pressSubtle} type="button" onClick={onClick} style={ghostActionStyle}>
      {children}
    </motion.button>
  );
}

/** Accent spinner used while broadcasting and while watching a transaction. */
export function StatusSpinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid var(--color-border-subtle)",
        borderTopColor: "var(--color-accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/** Overlay list of address suggestions positioned under an input card. */
export function AddressSuggestionsOverlay({
  suggestions,
  currentIdentity,
  onSelect,
  maxHeight,
  animated = false,
}: {
  suggestions: AddressSuggestion[];
  currentIdentity: string;
  onSelect: (identity: string) => void;
  maxHeight: number;
  animated?: boolean;
}) {
  const visible = suggestions.filter((suggestion) => suggestion.identity !== currentIdentity);
  if (visible.length === 0) return null;
  return (
    <div style={{
      position: "absolute", top: "100%", left: 8, right: 8, zIndex: 50,
      marginTop: "var(--space-1)", paddingTop: "var(--space-2)", paddingBottom: "var(--space-2)",
      background: "var(--color-bg-elevated)",
      borderRadius: "var(--radius-card)",
      border: "1px solid var(--color-border-subtle)",
      boxShadow: "var(--shadow-overlay)",
      maxHeight, overflowY: "auto",
      ...(animated ? { animation: "slide-down 0.15s ease-out" } : null),
    }}>
      <AddressSuggestions suggestions={visible} onSelect={onSelect} />
    </div>
  );
}

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
            key={isMaxSlot ? "max" : key}
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
