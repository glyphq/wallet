import type { PersistedState } from "./persisted-types";

/** Subset of Zustand's `setState` used by the persisted action creators. */
export type PersistedStoreSet = (
  partial:
    | PersistedState
    | Partial<PersistedState>
    | ((state: PersistedState) => PersistedState | Partial<PersistedState>)
) => void;
