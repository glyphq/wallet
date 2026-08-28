import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { router } from "@/router";
import { useDeepLink } from "@/hooks/use-deep-link";
import { usePayLink } from "@/hooks/use-pay-link";
import { usePersistedStore } from "@/store/persisted";
import { FONT_PAIRS, THEME_VARS, getThemeVars } from "@/lib/appearance";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";
import { useNotificationReconcile } from "@/hooks/use-notification-reconcile";
import { useUpdater } from "@/hooks/use-updater";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { recordRuntimeIssue } from "@/lib/runtime-issues";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "@/components/title-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { installRpcStoreSync, useRpcCacheSnapshot } from "@/hooks/use-rpc-cache-identity";
import { invalidateObsoleteRpcQueries } from "@/lib/rpc-cache-identity";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

// Install before React renders so legacy mutation paths never start on a stale
// singleton. Network-sensitive query paths use immutable snapshots instead.
installRpcStoreSync();

function useAppearance() {
  const { fontPair, themeMode } = usePersistedStore(
    useShallow((s) => ({
      fontPair: s.settings.fontPair,
      themeMode: s.settings.themeMode,
    }))
  );

  useEffect(() => {
    const pair = FONT_PAIRS.find((p) => p.id === fontPair) ?? FONT_PAIRS[0];
    const root = document.documentElement;
    root.style.setProperty("--font-sans", pair.sans);
    root.style.setProperty("--font-mono", pair.mono);
    root.style.setProperty("--font-display", pair.sans);
  }, [fontPair]);

  useEffect(() => {
    const root = document.documentElement;
    const vars = getThemeVars(themeMode);
    if (Object.keys(vars).length > 0) {
      for (const [key, val] of Object.entries(vars)) {
        root.style.setProperty(key, val);
      }
    } else {
      // Reset to CSS defaults (dark theme lives in :root stylesheet)
      for (const v of THEME_VARS) {
        root.style.removeProperty(v);
      }
    }
  }, [themeMode]);

}

function useRpcSync() {
  const snapshot = useRpcCacheSnapshot("both");
  const previousScopeRef = useRef(snapshot.network.scope);

  useEffect(() => {
    const previousScope = previousScopeRef.current;
    previousScopeRef.current = snapshot.network.scope;
    if (previousScope !== snapshot.network.scope) {
      void invalidateObsoleteRpcQueries(queryClient, previousScope);
    }
  }, [snapshot.network.scope]);
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

    window.addEventListener("glyph:disk-read-error", handleDiskReadError as EventListener);
    window.addEventListener("glyph:disk-write-error", handleDiskWriteError as EventListener);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("glyph:disk-read-error", handleDiskReadError as EventListener);
      window.removeEventListener("glyph:disk-write-error", handleDiskWriteError as EventListener);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
}

function usePriceSnapshotRecorder() {
  const { data: latestStats, dataUpdatedAt } = useLatestStats();
  const networkScope = usePersistedStore((s) => s.settings.network.scope);
  const addPriceSnapshot = usePersistedStore((s) => s.addPriceSnapshot);
  const sourceRef = useRef({ dataUpdatedAt: 0, scope: networkScope });

  // A network switch can briefly retain cached query data. Keep its original
  // scope until a fresh stats result is observed on the new network.
  if (latestStats && dataUpdatedAt !== sourceRef.current.dataUpdatedAt) {
    sourceRef.current = { dataUpdatedAt, scope: networkScope };
  }

  useEffect(() => {
    if (!latestStats || !Number.isFinite(latestStats.price)) return;
    addPriceSnapshot(
      { timestamp: Date.now(), priceUsd: latestStats.price },
      sourceRef.current.scope,
    );
  }, [addPriceSnapshot, dataUpdatedAt, latestStats?.price]);
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
