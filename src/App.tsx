import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { router } from "@/router";
import { useDeepLink } from "@/hooks/use-deep-link";
import { usePersistedStore } from "@/store/persisted";
import { FONT_PAIRS, ACCENT_COLORS, CUSTOM_SCHEME_VARS, deriveCustomScheme } from "@/lib/appearance";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";
import { useUpdater } from "@/hooks/use-updater";
import { useBobTick } from "@/hooks/use-bob-tick";
import { useBobSync } from "@/hooks/use-bob-sync";
import { useBobRealtime } from "@/hooks/use-bob-realtime";
import { configureRpc } from "@/lib/rpc";
import { requestNotificationPermission } from "@/lib/notifications";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "@/components/title-bar";
import { ErrorBoundary } from "@/components/error-boundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

function useAppearance() {
  const { theme, fontPair, accentColor, customScheme } = usePersistedStore(
    useShallow((s) => ({
      theme: s.settings.theme,
      fontPair: s.settings.fontPair,
      accentColor: s.settings.accentColor,
      customScheme: s.settings.customScheme,
    }))
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      root.setAttribute("data-theme", mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) =>
        root.setAttribute("data-theme", e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const pair = FONT_PAIRS.find((p) => p.id === fontPair) ?? FONT_PAIRS[0];
    const root = document.documentElement;
    root.style.setProperty("--font-sans", pair.sans);
    root.style.setProperty("--font-mono", pair.mono);
  }, [fontPair]);

  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENT_COLORS.find((a) => a.id === accentColor) ?? ACCENT_COLORS[0];

    if (customScheme) {
      const vars = deriveCustomScheme(customScheme.bg, customScheme.text, accent.hex);
      for (const [key, val] of Object.entries(vars)) {
        root.style.setProperty(key, val);
      }
    } else {
      for (const v of CUSTOM_SCHEME_VARS) {
        root.style.removeProperty(v);
      }
      root.style.setProperty("--color-status-success", accent.hex);
    }
  }, [accentColor, customScheme]);
}

function useRpcSync() {
  const { liveApiUrl, queryApiUrl } = usePersistedStore(
    useShallow((s) => ({
      liveApiUrl: s.settings.network.liveApiUrl,
      queryApiUrl: s.settings.network.queryApiUrl,
    }))
  );

  useEffect(() => {
    configureRpc(liveApiUrl, queryApiUrl);
  }, [liveApiUrl, queryApiUrl]);
}

function useNotificationInit() {
  const notificationsEnabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  // Use a ref so we only request once per session, not on every re-render.
  // The dependency on notificationsEnabled ensures we catch the async store hydration
  // (store loads from disk after mount, flipping false → true).
  const didInit = useRef(false);
  useEffect(() => {
    if (notificationsEnabled && !didInit.current) {
      didInit.current = true;
      requestNotificationPermission().catch(() => {});
    }
  }, [notificationsEnabled]);
}

function useHideToTray() {
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  useEffect(() => {
    invoke("set_hide_to_tray", { enabled: hideToTray }).catch(() => {});
  }, [hideToTray]);
}

function AppHooks() {
  useAppearance();
  useRpcSync();
  useDeepLink();
  useNotificationTriggers();
  useNotificationInit();
  useHideToTray();
  useBobTick();
  useBobSync();
  useBobRealtime();
  useUpdater();
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppHooks />
        <TitleBar />
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <RouterProvider router={router} />
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
