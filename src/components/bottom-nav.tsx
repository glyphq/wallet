import { useNavigate } from "react-router-dom";
import { HomeSmile, CardSend, CardReceive, MoneyBag, ClockCircle, Settings } from "@solar-icons/react";

export type BottomNavTab = "home" | "send" | "receive" | "earn" | "history" | "settings";

const TABS = [
  { id: "home" as BottomNavTab,     label: "Home",     icon: HomeSmile,     path: "/dashboard" },
  { id: "send" as BottomNavTab,     label: "Send",     icon: CardSend,      path: "/send" },
  { id: "receive" as BottomNavTab,  label: "Receive",  icon: CardReceive,   path: "/receive" },
  { id: "earn" as BottomNavTab,     label: "Earn",     icon: MoneyBag,      path: "/earn" },
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
        padding: 0,
        background: "var(--color-bg-base)",
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
              flexDirection: "column",
              flex: "1 1 0",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-1)",
              minHeight: 58,
              padding: "var(--space-3) var(--space-1)",
              background: "transparent",
              borderRadius: "var(--radius-control)",
              border: "none",
              cursor: "pointer",
              color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              transition: "color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)",
              minWidth: 44,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--color-text-primary)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = "var(--color-text-secondary)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                width: 24,
                height: 2,
                borderRadius: 999,
                background: isActive ? "var(--color-accent)" : "transparent",
                transition: "background-color var(--duration-fast) var(--ease-out)",
              }}
            />
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={24} weight={isActive ? "BoldDuotone" : "Linear"} aria-hidden="true" />
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", fontWeight: isActive ? 600 : 500, lineHeight: 1.1, whiteSpace: "nowrap" }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
