import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

export interface UpdaterState {
  appVersion: string;
  update: Update | null;
  checking: boolean;
  installing: boolean;
  progress: number;
  install: () => Promise<void>;
}

export function useUpdater(): UpdaterState {
  const [appVersion, setAppVersion] = useState("");
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});

    // Delay check to avoid slowing down startup
    const timer = setTimeout(() => {
      check()
        .then((u) => setUpdate(u ?? null))
        .catch(() => {})
        .finally(() => setChecking(false));
    }, 8_000);

    return () => clearTimeout(timer);
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
    } catch {
      setInstalling(false);
    }
  }

  return { appVersion, update, checking, installing, progress, install };
}
