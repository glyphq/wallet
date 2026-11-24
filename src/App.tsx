import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { router } from "@/router";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { THEME_VARS, getThemeVars } from "@/lib/appearance";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";
import { useNotificationReconcile } from "@/hooks/use-notification-reconcile";
import { useUpdater } from "@/hooks/use-updater";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { configureApiClient, getApiBaseUrl } from "@/lib/api/client";
import { recordRuntimeIssue } from "@/lib/runtime-issues";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  const themeMode = usePersistedStore((s) => s.settings.themeMode);

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

function useNetworkSync() {
  const apiUrl = usePersistedStore((s) => s.settings.network.apiUrl);
  const queryClient = useQueryClient();

  useEffect(() => {
    const previous = getApiBaseUrl();
    const configured = configureApiClient(apiUrl);
    // Generated query keys are path-based; clear the cache rather than serving
    // data cached from a different network under the same keys.
    if (configured !== previous) queryClient.clear();
  }, [apiUrl, queryClient]);
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
  const { data: latestStats } = useLatestStats();
  const addPriceSnapshot = usePersistedStore((s) => s.addPriceSnapshot);
  const price = latestStats?.price;

  useEffect(() => {
    if (price === undefined || !Number.isFinite(price)) return;
    addPriceSnapshot({ timestamp: Date.now(), priceUsd: price });
  }, [addPriceSnapshot, price]);
}

function useApprovalUnlockSync() {
  useEffect(() => {
    const pending = listen<{ walletId?: string }>("glyph:session-unlocked", async (event) => {
      const accounts = await invoke<{ identity: string; publicKey: number[] }[]>("get_session_accounts").catch(() => []);
      if (accounts.length === 0) return;
      const walletId = event.payload?.walletId ?? usePersistedStore.getState().settings.activeWalletId ?? "approval";
      useSessionStore.getState().unlock(walletId, accounts.map((account) => ({
        identity: account.identity,
        publicKey: new Uint8Array(account.publicKey),
      })));
      usePersistedStore.getState().setActiveWallet(walletId);
      if (window.location.hash === "" || window.location.hash.startsWith("#/lock")) {
        window.location.hash = "#/dashboard";
      }
    });
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);
}

function AppHooks() {
  useApprovalUnlockSync();
  useAppearance();
  useNetworkSync();
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
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <RouterProvider router={router} />
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
