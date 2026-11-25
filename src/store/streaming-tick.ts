import { create } from "zustand";

interface StreamingTickState {
  tick: number | null;
  setTick: (tick: number | null) => void;
}

/** Latest tick from the shared stream; kept at shell scope so route changes do not reset it. */
export const useStreamingTickStore = create<StreamingTickState>((set) => ({
  tick: null,
  setTick: (tick) => set({ tick }),
}));
