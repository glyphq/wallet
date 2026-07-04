import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { HomeSmile, CardSend, CardReceive, MoneyBag, ClockCircle, Settings } from "@solar-icons/react";

export type BottomNavTab = "home" | "send" | "receive" | "earn" | "history" | "settings";

const TABS = [
  { id: "home" as BottomNavTab,     icon: HomeSmile,     path: "/dashboard" },
  { id: "send" as BottomNavTab,     icon: CardSend,      path: "/send" },
  { id: "receive" as BottomNavTab,  icon: CardReceive,   path: "/receive" },
  { id: "earn" as BottomNavTab,     icon: MoneyBag,      path: "/earn" },
  { id: "history" as BottomNavTab,  icon: ClockCircle,   path: "/history" },
  { id: "settings" as BottomNavTab, icon: Settings,      path: "/settings" },
];

export function BottomNav({ active }: { active: BottomNavTab }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-3)",
        background: "rgba(28, 28, 30, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: "var(--radius-pill)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {TABS.map(({ id, icon: Icon, path }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => { if (!isActive) navigate(path); }}
            aria-current={isActive ? "page" : undefined}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1px",
              height: 48,
              padding: isActive ? "0 14px" : "0 12px",
              background: "none",
              borderRadius: "var(--radius-pill)",
              border: "none",
              cursor: "pointer",
              color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
              transition: "color 200ms ease-in-out",
              minWidth: 48,
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--color-text-display)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--color-text-secondary)"; }}
          >
            {isActive && (
              <motion.span
                layoutId="nav-pill"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(204, 252, 251, 0.1)",
                  borderRadius: "var(--radius-pill)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={22} weight={isActive ? "BoldDuotone" : "Linear"} aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
