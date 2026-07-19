import { useLayoutEffect, useRef } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "@/lib/animations";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { useLockCountdown } from "@/hooks/use-lock-countdown";
import { BottomNav, type BottomNavTab } from "@/components/bottom-nav";
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
  ["/payment-link", "receive"],
  ["/earn", "earn"],
  ["/history", "history"],
  ["/analytics", "history"],
  ["/contacts", "history"],
  ["/search", "history"],
  ["/vaults", "home"],
  ["/settings", "settings"],
];

/** Instant transition — no animation for lateral navigation within a section. */
const instantTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0 },
} as const;

function showChrome(pathname: string): boolean {
  if (HIDDEN_CHROME_ROUTES.has(pathname)) return false;
  if (pathname.startsWith("/settings/")) return false;
  return true;
}

function activeTabFromPath(pathname: string): BottomNavTab {
  for (const [prefix, tab] of NAV_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return tab;
  }
  return "home";
}

/** Returns true when both paths are within the same top-level section. */
function isSameSection(a: string, b: string): boolean {
  if (a.startsWith("/settings") && b.startsWith("/settings")) return true;
  if (a.startsWith("/vaults") && b.startsWith("/vaults")) return true;
  if (a.startsWith("/setup") && b.startsWith("/setup")) return true;
  return false;
}

// ── Layout shell (inside provider) ───────────────────────────────────────────

function LayoutShell() {
  const location = useLocation();
  const element = useOutlet();
  const { header } = useHeaderSlot();
  const countdown = useLockCountdown();
  const cur = location.pathname;
  const show = showChrome(cur);
  const showNav = show;
  const sheetsOpen = useSheetsOpen();

  const prevRef = useRef(cur);
  const prev = prevRef.current;
  useLayoutEffect(() => { prevRef.current = cur; }, [cur]);

  // Use instant transition for lateral navigation within a section
  const transition = isSameSection(prev, cur) ? instantTransition : pageTransition;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ── Static header ── */}
      {show && header && (
        <header
          style={{
            flexShrink: 0,
            height: "var(--height-header)",
            display: "flex",
            alignItems: "center",
            padding: "0 var(--screen-padding)",
            borderBottom: "1px solid var(--color-border-default)",
            background: "var(--color-bg-base)",
          }}
        >
          {header}
        </header>
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
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.key}
            {...transition}
            style={{ height: "100%", position: "absolute", inset: 0 }}
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

  return (
    <SheetStateProvider>
      <HeaderSlotProvider>
        <LayoutShell />
      </HeaderSlotProvider>
    </SheetStateProvider>
  );
}
