import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition, sectionTransition } from "@/lib/animations";
import { Download01Icon, LockKeyholeIcon } from "@/lib/icons";
import { useUpdaterStore } from "@/store/updater";
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
import { ChromeVisibilityProvider, useChromeVisibility } from "./chrome-visibility";

// ── Route helpers ────────────────────────────────────────────────────────────

const HIDDEN_CHROME_ROUTES = new Set(["/", "/lock", "/setup", "/setup/create", "/setup/import", "/request"]);

const NAV_PREFIXES: [string, BottomNavTab][] = [
  ["/dashboard", "home"],
  ["/send", "send"],
  ["/send-many", "send"],
  ["/burn", "send"],
  ["/stake", "send"],
  ["/multisig", "home"],
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
  if (pathname.startsWith("/multisig/")) return false;
  if (pathname.startsWith("/contacts/")) return false;
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return false;
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

  if (pathname === "/multisig") return "Multisig";
  if (pathname === "/multisig/new") return "New multisig";
  if (pathname.startsWith("/multisig/") && pathname.endsWith("/deposit")) return "Deposit";
  if (pathname.startsWith("/multisig/") && pathname.endsWith("/release")) return "Release";
  if (pathname.startsWith("/multisig/") && pathname.endsWith("/approvals")) return "Pending approvals";
  if (pathname.startsWith("/multisig/")) return "Multisig vault";

  for (const [prefix, title] of HEADER_TITLES) {
    if (prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(prefix + "/")) {
      return title;
    }
  }
  return null;
}

function backTargetFromPath(pathname: string): string | null {
  if (pathname === "/multisig/new") return "/multisig";
  if (pathname.startsWith("/multisig/") && (pathname.endsWith("/deposit") || pathname.endsWith("/release") || pathname.endsWith("/approvals"))) {
    return pathname.slice(0, pathname.lastIndexOf("/"));
  }
  if (pathname.startsWith("/multisig/")) return "/multisig";
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
  if (a.startsWith("/multisig") && b.startsWith("/multisig")) return true;
  return false;
}

// ── Layout shell (inside provider) ───────────────────────────────────────────

function LayoutShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const element = useOutlet();
  const { header } = useHeaderSlot();
  const { hidden: chromeHidden } = useChromeVisibility();
  const countdown = useLockCountdown();
  const update = useUpdaterStore((s) => s.update);
  const updaterContext = useUpdaterStore((s) => s.context);
  const installing = useUpdaterStore((s) => s.installing);
  const updateProgress = useUpdaterStore((s) => s.progress);
  const installUpdate = useUpdaterStore((s) => s.install);
  const cur = location.pathname;
  const show = !chromeHidden && showHeader(cur);
  const showNav = !chromeHidden && showBottomNav(cur);
  const sheetsOpen = useSheetsOpen();
  const routeTitle = headerTitleFromPath(cur);
  const backTarget = backTargetFromPath(cur);
  const resolvedHeader = header ?? (cur === "/settings"
    ? <ScreenHeader title="Settings" onBack={() => navigate("/dashboard")} backAriaLabel="Back to dashboard" />
    : cur === "/wallets/switch"
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

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
          <AnimatePresence>
            {update && updaterContext?.supportsAutoUpdate && showNav && !sheetsOpen ? (
              <motion.div
                key="app-update"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                style={{ pointerEvents: "auto" }}
              >
                <button
                  type="button"
                  onClick={() => void installUpdate()}
                  disabled={installing}
                  aria-label={installing ? `Installing Glyph ${update.version}` : `Install Glyph ${update.version}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "4px 10px",
                    border: 0,
                    background: "var(--color-bg-nav)",
                    borderRadius: "var(--radius-sharp) var(--radius-sharp) 0 0",
                    color: "var(--color-accent)",
                    cursor: installing ? "default" : "pointer",
                  }}
                >
                  <Download01Icon size={13} aria-hidden="true" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Update
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontVariantNumeric: "tabular-nums", color: "var(--color-accent)" }}>
                    {installing ? updateProgress > 0 ? `${updateProgress}%` : "Installing" : `v${update.version}`}
                  </span>
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                key="lock-countdown"
                role="status"
                aria-live="polite"
                aria-label={`Locking in ${countdown} seconds`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "4px 10px",
                    background: "var(--color-bg-nav)",
                    borderRadius: "var(--radius-sharp) var(--radius-sharp) 0 0",
                    color: "var(--color-status-warning)",
                  }}
                >
                  <LockKeyholeIcon size={13} strokeWidth={1.5} aria-hidden="true" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Locking in
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontVariantNumeric: "tabular-nums", color: "var(--color-status-warning)" }}>
                    {countdown}s
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
        <ChromeVisibilityProvider>
          <LayoutShell />
        </ChromeVisibilityProvider>
      </HeaderSlotProvider>
    </SheetStateProvider>
  );
}
