import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { notify } from "@/lib/notifications";

export function useUpdater() {
  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const update = await check();
        if (cancelled || !update?.available) return;

        await notify(
          "Update available",
          `Sigil ${update.version} is ready to install`,
        );

        await update.downloadAndInstall();
        await relaunch();
      } catch {
        // Silently ignore — update check failing should never surface to user
      }
    }

    // Delay check to avoid slowing down startup
    const timer = setTimeout(checkForUpdate, 8_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
}
