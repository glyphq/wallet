import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface HeaderSlotValue {
  header: ReactNode;
  setHeader: (node: ReactNode) => void;
}

const HeaderSlotCtx = createContext<HeaderSlotValue>({ header: null, setHeader: () => {} });

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ReactNode>(null);
  const stable = useCallback((node: ReactNode) => setHeader(node), []);
  return (
    <HeaderSlotCtx.Provider value={{ header, setHeader: stable }}>
      {children}
    </HeaderSlotCtx.Provider>
  );
}

export function useHeaderSlot() {
  return useContext(HeaderSlotCtx);
}
