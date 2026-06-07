import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { router } from "@/router";
import { useDeepLink } from "@/hooks/use-deep-link";
import { usePayLink } from "@/hooks/use-pay-link";
import { usePersistedStore } from "@/store/persisted";
import { FONT_PAIRS, ACCENT_COLORS, CUSTOM_SCHEME_VARS, deriveCustomScheme } from "@/lib/appearance";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";
import { useNotificationReconcile } from "@/hooks/use-notification-reconcile";
import { useUpdater } from "@/hooks/use-updater";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { configureRpc } from "@/lib/rpc";
import { recordRuntimeIssue } from "@/lib/runtime-issues";
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

function useHideToTray() {
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  useEffect(() => {
    invoke("set_hide_to_tray", { enabled: hideToTray }).catch(() => {});
  }, [hideToTray]);
}

function useRuntimeDiagnostics() {
  useEffect(() => {
    function handleDiskReadError() {
      recordRuntimeIssue({
        source: "storage",
        title: "Encrypted store read failed",
        detail: "The persisted store could not be decrypted or loaded from disk.",
      });
    }

    function handleDiskWriteError() {
      recordRuntimeIssue({
        source: "storage",
        title: "Encrypted store write failed",
        detail: "The persisted store could not be written to disk.",
      });
    }

    function handleError(event: ErrorEvent) {
      recordRuntimeIssue({
        source: "renderer",
        title: "Unhandled renderer error",
        detail: event.message || "Unknown renderer error",
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unknown rejection");
      recordRuntimeIssue({
        source: "renderer",
        title: "Unhandled promise rejection",
        detail: reason,
      });
    }

    window.addEventListener("sigil:disk-read-error", handleDiskReadError as EventListener);
    window.addEventListener("sigil:disk-write-error", handleDiskWriteError as EventListener);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("sigil:disk-read-error", handleDiskReadError as EventListener);
      window.removeEventListener("sigil:disk-write-error", handleDiskWriteError as EventListener);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
}

function usePriceSnapshotRecorder() {
  const { data: latestStats } = useLatestStats();
  const addPriceSnapshot = usePersistedStore((s) => s.addPriceSnapshot);

  useEffect(() => {
    if (!latestStats || !Number.isFinite(latestStats.price)) return;
    addPriceSnapshot({ timestamp: Date.now(), priceUsd: latestStats.price });
  }, [addPriceSnapshot, latestStats?.price]);
}

function AppHooks() {
  useAppearance();
  useRpcSync();
  useDeepLink();
  usePayLink();
  useNotificationTriggers();
  useNotificationReconcile();
  useHideToTray();
  useRuntimeDiagnostics();
  usePriceSnapshotRecorder();
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
