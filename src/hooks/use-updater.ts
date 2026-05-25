import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { recordRuntimeIssue } from "@/lib/runtime-issues";

export interface UpdaterState {
  appVersion: string;
  update: Update | null;
  checking: boolean;
  upToDate: boolean;
  checkError: boolean;
  installing: boolean;
  progress: number;
  lastCheckedAt: number | null;
  lastError: string;
  install: () => Promise<void>;
}

export function useUpdater(): UpdaterState {
  const [appVersion, setAppVersion] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(true);
  const [upToDate, setUpToDate] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});

    check()
      .then((u) => {
        setLastCheckedAt(Date.now());
        if (u) {
          setUpdate(u);
        } else {
          setUpToDate(true);
        }
      })
      .catch((error) => {
        setCheckError(true);
        setLastError("Update check failed.");
        recordRuntimeIssue({
          source: "updater",
          title: "Updater check failed",
          detail: error instanceof Error ? error.message : "Unknown updater check error",
        });
      })
      .finally(() => setChecking(false));

  }, []);

  async function install() {
    if (!update) return;
    setInstalling(true);
    let downloaded = 0;
    let total = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setProgress(total > 0 ? Math.round((downloaded / total) * 100) : 0);
        }
      });
      await relaunch();
    } catch (error) {
      setLastError("Update install failed.");
      recordRuntimeIssue({
        source: "updater",
        title: "Updater install failed",
        detail: error instanceof Error ? error.message : "Unknown updater install error",
      });
      setInstalling(false);
    }
  }

  return { appVersion, update, checking, upToDate, checkError, installing, progress, lastCheckedAt, lastError, install };
}
