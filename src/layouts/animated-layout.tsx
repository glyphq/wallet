import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition, sectionTransition } from "@/lib/animations";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { useDisableHistoryNavigation } from "@/hooks/use-disable-history-navigation";
import { useLockCountdown } from "@/hooks/use-lock-countdown";
import { BottomNav, type BottomNavTab } from "@/components/bottom-nav";
import { TitleBar } from "@/components/title-bar";
import { AsciiPageHeader } from "@/components/ascii-page-header";
import { ScreenHeader } from "@/components/screen-header";
import { ShellWalletSwitcher } from "@/components/shell-wallet-switcher";
import { HeaderSlotProvider, useHeaderSlot } from "./header-slot";
import { SheetStateProvider, useSheetsOpen } from "./sheet-state";

// ── Route helpers ────────────────────────────────────────────────────────────

const HIDDEN_CHROME_ROUTES = new Set(["/", "/lock", "/setup", "/setup/create", "/setup/import", "/request"]);

const NAV_PREFIXES: [string, BottomNavTab][] = [
  ["/dashboard", "home"],
  ["/send", "send"],
  ["/send-many", "send"],
  ["/burn", "send"],
  ["/stake", "send"],
  ["/receive", "receive"],
  ["/history", "history"],
  ["/analytics", "history"],
  ["/contacts", "history"],
  ["/search", "history"],
  ["/wallets", "home"],
  ["/settings", "settings"],
];

const HEADER_TITLES: [string, string][] = [
  ["/dashboard", "Dashboard"],
  ["/wallets/switch", "Switch wallet"],
  ["/wallets/:id/portfolio", "Portfolio"],
  ["/wallets", "Wallets"],
  ["/wallets/", "Wallet details"],
  ["/send/scheduled", "Scheduled transfers"],
  ["/send-many", "Send many"],
  ["/send", "Send"],
  ["/burn", "Burn"],
  ["/stake", "Stake"],
  ["/receive", "Receive"],
  ["/tx/", "Transaction"],
  ["/analytics", "Analytics"],
  ["/history", "History"],
  ["/contacts", "Contacts"],
  ["/search", "Search"],
  ["/settings", "Settings"],
];

function showHeader(pathname: string): boolean {
  if (HIDDEN_CHROME_ROUTES.has(pathname)) return false;
  return true;
}

function showBottomNav(pathname: string): boolean {
  if (HIDDEN_CHROME_ROUTES.has(pathname)) return false;
  if (pathname === "/wallets/switch") return false;
  if (pathname.startsWith("/settings/")) return false;
  return true;
}

function activeTabFromPath(pathname: string): BottomNavTab {
  for (const [prefix, tab] of NAV_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return tab;
  }
  return "home";
}

function headerTitleFromPath(pathname: string): string | null {
  if (pathname.endsWith("/portfolio")) return "Portfolio";

  for (const [prefix, title] of HEADER_TITLES) {
    if (prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(prefix + "/")) {
      return title;
    }
  }
  return null;
}

function backTargetFromPath(pathname: string): string | null {
  if (pathname.endsWith("/portfolio") && pathname.startsWith("/wallets/")) {
    return pathname.slice(0, -"/portfolio".length);
  }
  if (pathname.startsWith("/wallets/")) return "/wallets";
  if (pathname === "/send/scheduled" || pathname === "/send-many" || pathname === "/burn") return "/send";
  if (pathname.startsWith("/tx/") || pathname === "/analytics") return "/history";
  if (pathname === "/search") return "/dashboard";
  return null;
}

/** Returns true when both paths are within the same top-level section. */
function isSameSection(a: string, b: string): boolean {
  if (a.startsWith("/settings") && b.startsWith("/settings")) return true;
  if (a.startsWith("/wallets") && b.startsWith("/wallets")) return true;
  if (a.startsWith("/setup") && b.startsWith("/setup")) return true;
  return false;
}

// ── Layout shell (inside provider) ───────────────────────────────────────────

function LayoutShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const element = useOutlet();
  const { header } = useHeaderSlot();
  const countdown = useLockCountdown();
  const cur = location.pathname;
  const show = showHeader(cur);
  const showNav = showBottomNav(cur);
  const sheetsOpen = useSheetsOpen();
  const routeTitle = headerTitleFromPath(cur);
  const backTarget = backTargetFromPath(cur);
  const resolvedHeader = header ?? (cur === "/wallets/switch"
    ? <ScreenHeader title="Switch wallet" onBack={() => navigate(-1)} />
    : routeTitle
      ? backTarget
        ? <ScreenHeader title={routeTitle} onBack={() => navigate(backTarget)} />
        : <ScreenHeader leading={<ShellWalletSwitcher />} title={routeTitle} />
      : null);

  const prevRef = useRef(cur);
  const prev = prevRef.current;
  useLayoutEffect(() => { prevRef.current = cur; }, [cur]);

  // Keep the shell header still while the page content moves within a section.
  const transition = isSameSection(prev, cur) ? sectionTransition : pageTransition;

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {cur !== "/" && <TitleBar />}

      {/* ── Static header ── */}
      {show && resolvedHeader && (
        <AsciiPageHeader borderBottom={cur !== "/dashboard"}>{resolvedHeader}</AsciiPageHeader>
      )}

      {/* ── Lock countdown banner ── */}
      {countdown !== null && (
        <div
          aria-live="polite"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-2) var(--screen-padding)",
            background: "var(--color-bg-surface)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.04em" }}>
            Locking in {countdown}s
          </span>
        </div>
      )}

      {/* ── Animated page content ── */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative", overflow: "hidden" }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={location.key}
            {...transition}
            style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, minWidth: 0, position: "absolute", inset: 0 }}
          >
            {element}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Anchored bottom nav ── */}
      {showNav && !sheetsOpen && (
        <footer
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            padding: `var(--space-2) var(--screen-padding) var(--safe-bottom-space)`,
            background: "var(--color-bg-base)",
            zIndex: "var(--z-nav)",
          }}
        >
          <BottomNav active={activeTabFromPath(cur)} />
        </footer>
      )}
    </div>
  );
}

// ── Exported layout ──────────────────────────────────────────────────────────

export function AnimatedLayout() {
  useAutoLock();
  useDisableHistoryNavigation();

  return (
    <SheetStateProvider>
      <HeaderSlotProvider>
        <LayoutShell />
      </HeaderSlotProvider>
    </SheetStateProvider>
  );
}
