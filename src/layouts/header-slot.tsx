import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from "react";

interface HeaderSlotValue {
  header: ReactNode;
  setHeader: (node: ReactNode) => void;
  clearHeader: (node: ReactNode) => void;
}

const HeaderSlotCtx = createContext<HeaderSlotValue>({ header: null, setHeader: () => {}, clearHeader: () => {} });

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<ReactNode>(null);
  const current = useRef<ReactNode>(null);
  const setHeader = useCallback((node: ReactNode) => {
    current.current = node;
    setHeaderState(node);
  }, []);
  const clearHeader = useCallback((node: ReactNode) => {
    if (current.current !== node) return;
    current.current = null;
    setHeaderState(null);
  }, []);
  const value = useMemo(
    () => ({ header, setHeader, clearHeader }),
    [header, setHeader, clearHeader],
  );
  return (
    <HeaderSlotCtx.Provider value={value}>
      {children}
    </HeaderSlotCtx.Provider>
  );
}

export function useHeaderSlot() {
  return useContext(HeaderSlotCtx);
}
