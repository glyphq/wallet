import { useNavigate } from "react-router-dom";
import { HomeSmile, CardSend, CardReceive, ClockCircle, Settings } from "@solar-icons/react";

export type BottomNavTab = "home" | "send" | "receive" | "history" | "settings";

const TABS = [
  { id: "home" as BottomNavTab,     label: "Home",     icon: HomeSmile,     path: "/dashboard" },
  { id: "send" as BottomNavTab,     label: "Send",     icon: CardSend,      path: "/send" },
  { id: "receive" as BottomNavTab,  label: "Receive",  icon: CardReceive,   path: "/receive" },
  { id: "history" as BottomNavTab,  label: "History",  icon: ClockCircle,   path: "/history" },
  { id: "settings" as BottomNavTab, label: "Settings", icon: Settings,      path: "/settings" },
];

export function BottomNav({ active }: { active: BottomNavTab }) {
  const navigate = useNavigate();
  return (
    <nav
      aria-label="Primary"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-1)",
        width: "100%",
        maxWidth: 420,
        minHeight: "var(--height-nav)",
        boxSizing: "border-box",
        padding: "2px var(--space-1)",
        background: "var(--color-bg-nav)",
        borderRadius: "var(--radius-card)",
      }}
    >
      {TABS.map(({ id, label, icon: Icon, path }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => { if (!isActive) navigate(path); }}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            style={{
              position: "relative",
              display: "flex",
              flex: "1 1 0",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              padding: "var(--space-1) var(--space-1)",
              background: isActive ? "var(--color-bg-subtle)" : "transparent",
              borderRadius: "var(--radius-control)",
              border: "none",
              cursor: "pointer",
              color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              transition: "color var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out)",
              minWidth: 44,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--color-text-primary)";
                e.currentTarget.style.background = "var(--color-bg-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--color-text-secondary)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 4,
                width: 18,
                height: 2,
                borderRadius: 999,
                background: isActive ? "var(--color-text-primary)" : "transparent",
                transition: "background-color var(--duration-fast) var(--ease-out)",
              }}
            />
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={24} weight={isActive ? "BoldDuotone" : "Linear"} aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
