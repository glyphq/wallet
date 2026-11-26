import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

interface ChromeVisibility {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const ChromeVisibilityContext = createContext<ChromeVisibility>({
  hidden: false,
  setHidden: () => {},
});

export function ChromeVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <ChromeVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </ChromeVisibilityContext.Provider>
  );
}

export function useChromeVisibility() {
  return useContext(ChromeVisibilityContext);
}

/** Hide app navigation while a focused send step is mounted. */
export function useHideAppChrome() {
  const { setHidden } = useChromeVisibility();
  useLayoutEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);
}
