import { createContext, useContext, type ReactNode } from "react";

interface RequestStatus {
  expirySecsLeft: number | null;
}

const RequestStatusContext = createContext<RequestStatus>({ expirySecsLeft: null });

export function RequestStatusProvider({ expirySecsLeft, children }: RequestStatus & { children: ReactNode }) {
  return (
    <RequestStatusContext.Provider value={{ expirySecsLeft }}>
      {children}
    </RequestStatusContext.Provider>
  );
}

export function useRequestStatus() {
  return useContext(RequestStatusContext);
}
