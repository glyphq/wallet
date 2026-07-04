import { useLayoutEffect, useRef } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { useLockCountdown } from "@/hooks/use-lock-countdown";
import { BottomNav, type BottomNavTab } from "@/components/bottom-nav";
import { HeaderSlotProvider, useHeaderSlot } from "./header-slot";

// ── Route helpers ────────────────────────────────────────────────────────────

const HIDDEN_CHROME_ROUTES = new Set(["/", "/lock", "/setup", "/setup/create", "/setup/import", "/request"]);

const HIDDEN_NAV_ROUTES = new Set(["/send", "/send-many", "/burn", "/earn"]);

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

// ── Layout shell (inside provider) ───────────────────────────────────────────

function LayoutShell() {
  const location = useLocation();
  const element = useOutlet();
  const { header } = useHeaderSlot();
  const countdown = useLockCountdown();
  const cur = location.pathname;
  const show = showChrome(cur);
  const showNav = show && !HIDDEN_NAV_ROUTES.has(cur);

  const prevRef = useRef(cur);
  useLayoutEffect(() => { prevRef.current = cur; }, [cur]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ── Static header ── */}
      {show && header && (
        <header
          style={{
            flexShrink: 0,
            height: 44,
            display: "flex",
            alignItems: "center",
            padding: "0 var(--space-4)",
            borderBottom: "1px solid var(--color-border-subtle)",
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
            padding: "var(--space-1) var(--space-4)",
            background: "var(--color-bg-elevated)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
            Locking in {countdown}s
          </span>
        </div>
      )}

      {/* ── Animated page content ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08, ease: "easeOut" } }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ height: "100%", position: "absolute", inset: 0 }}
          >
            {element}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Floating bottom nav ── */}
      {showNav && (
        <nav
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
          }}
        >
          <BottomNav active={activeTabFromPath(cur)} />
        </nav>
      )}
    </div>
  );
}

// ── Exported layout ──────────────────────────────────────────────────────────

export function AnimatedLayout() {
  useAutoLock();

  return (
    <HeaderSlotProvider>
      <LayoutShell />
    </HeaderSlotProvider>
  );
}
