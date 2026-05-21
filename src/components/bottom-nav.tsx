import { useNavigate } from "react-router-dom";
import { Home, ArrowUp, ArrowDown, Clock, Settings } from "lucide-react";

export type BottomNavTab = "home" | "send" | "receive" | "history" | "settings";

const TABS = [
  { id: "home" as BottomNavTab,     icon: Home,     label: "HOME",     path: "/dashboard" },
  { id: "send" as BottomNavTab,     icon: ArrowUp,  label: "SEND",     path: "/send" },
  { id: "receive" as BottomNavTab,  icon: ArrowDown,label: "RECEIVE",  path: "/receive" },
  { id: "history" as BottomNavTab,  icon: Clock,    label: "HISTORY",  path: "/history" },
  { id: "settings" as BottomNavTab, icon: Settings, label: "SETTINGS", path: "/settings" },
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
          <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em" }}>
            {label}
          </span>
        </button>
      ))}
    </>
  );
}
