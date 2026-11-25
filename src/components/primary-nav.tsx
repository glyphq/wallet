import { useNavigate } from "react-router";
import { Home01Icon, MoneySend01Icon, MoneyReceive01Icon, Clock01Icon, Settings01Icon } from "@/lib/icons";

export type PrimaryNavTab = "home" | "send" | "receive" | "history" | "settings";

const TABS = [
  { id: "home" as PrimaryNavTab, label: "Home", icon: Home01Icon, path: "/dashboard" },
  { id: "send" as PrimaryNavTab, label: "Send", icon: MoneySend01Icon, path: "/send" },
  { id: "receive" as PrimaryNavTab, label: "Receive", icon: MoneyReceive01Icon, path: "/receive" },
  { id: "history" as PrimaryNavTab, label: "History", icon: Clock01Icon, path: "/history" },
  { id: "settings" as PrimaryNavTab, label: "Settings", icon: Settings01Icon, path: "/settings" },
];

/** Primary navigation rendered in the same flat action language as the title bar. */
export function PrimaryNav({ active }: { active: PrimaryNavTab }) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Primary"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "stretch",
        height: "var(--height-nav)",
      }}
    >
      {TABS.map(({ id, label, icon: Icon, path }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            className="primary-nav-action corner-frame"
            data-active={isActive ? "true" : "false"}
            onClick={() => {
              if (!isActive) navigate(path);
            }}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            title={label}
          >
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
