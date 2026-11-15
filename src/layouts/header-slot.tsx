import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface HeaderSlotValue {
  header: ReactNode;
  setHeader: (node: ReactNode) => void;
}

const HeaderSlotCtx = createContext<HeaderSlotValue>({ header: null, setHeader: () => {} });

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ReactNode>(null);
  const stable = useCallback((node: ReactNode) => setHeader(node), []);
  const value = useMemo(() => ({ header, setHeader: stable }), [header, stable]);
  return (
    <HeaderSlotCtx.Provider value={value}>
      {children}
    </HeaderSlotCtx.Provider>
  );
}

export function useHeaderSlot() {
  return useContext(HeaderSlotCtx);
}
