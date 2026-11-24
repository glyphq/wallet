import { createContext, useContext } from "react";

const RequestFooterContext = createContext<HTMLElement | null>(null);

export const RequestFooterProvider = RequestFooterContext.Provider;

export function useRequestFooter() {
  return useContext(RequestFooterContext);
}
