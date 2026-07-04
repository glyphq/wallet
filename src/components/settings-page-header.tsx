import { useNavigate } from "react-router-dom";
import { AltArrowLeft } from "@solar-icons/react";

/**
 * Inline header for settings subpages.
 * The slot-based header is hidden for /settings/* routes by showChrome,
 * so each subpage renders its own header inline.
 */
export function SettingsPageHeader({ title, backTo = "/settings" }: { title: string; backTo?: string }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative", height: 44, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => navigate(backTo)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
      >
        <AltArrowLeft size={20} style={{ color: "var(--color-text-primary)" }} />
      </button>
      <span style={{
        position: "absolute", left: "50%", transform: "translateX(-50%)",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500,
        color: "var(--color-text-display)", whiteSpace: "nowrap",
      }}>
        {title}
      </span>
    </div>
  );
}
