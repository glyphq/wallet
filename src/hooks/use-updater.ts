import { useEffect } from "react";
import { useUpdaterStore } from "@/store/updater";

export function useUpdater() {
  const init = useUpdaterStore((s) => s.init);

  useEffect(() => {
    init().catch(() => {});
  }, [init]);

  return useUpdaterStore();
}
