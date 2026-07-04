import { useNavigate } from "react-router-dom";
import { HomeSmile, CardSend, CardReceive, ClockCircle, Settings } from "@solar-icons/react";

export type BottomNavTab = "home" | "send" | "receive" | "history" | "settings";

const TABS = [
  { id: "home" as BottomNavTab,     icon: HomeSmile,       label: "Home",     path: "/dashboard" },
  { id: "send" as BottomNavTab,     icon: CardSend,      label: "Send",     path: "/send" },
  { id: "receive" as BottomNavTab,  icon: CardReceive,   label: "Receive",  path: "/receive" },
  { id: "history" as BottomNavTab,  icon: ClockCircle,     label: "History",  path: "/history" },
  { id: "settings" as BottomNavTab, icon: Settings,        label: "Settings", path: "/settings" },
];

export function BottomNav({ active }: { active: BottomNavTab }) {
  const navigate = useNavigate();
  return (
    <>
      {TABS.map(({ id, icon: Icon, label, path }) => (
        <button
          key={id}
          onClick={() => { if (id !== active) navigate(path); }}
          aria-current={id === active ? "page" : undefined}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: id === active ? "var(--color-text-display)" : "var(--color-text-disabled)",
          }}
        >
          <Icon size={18} weight="Linear" aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: id === active ? "var(--color-text-primary)" : "var(--color-text-disabled)" }}>
            {label}
          </span>
        </button>
      ))}
    </>
  );
}
