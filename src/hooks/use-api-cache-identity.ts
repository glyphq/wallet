import { useShallow } from "zustand/react/shallow";
import { apiCacheIdentity } from "@/lib/api-cache-identity";
import { usePersistedStore } from "@/store/persisted";

/** Cache scope for the configured Glyph API origin. */
export function useApiCacheIdentity() {
  const network = usePersistedStore(
    useShallow((s) => ({ apiUrl: s.settings.network.apiUrl })),
  );
  return apiCacheIdentity(network);
}
