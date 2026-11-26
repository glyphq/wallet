import { createContext, useContext, type ReactNode } from "react";

interface RequestStatus {
  expirySecsLeft: number | null;
  pendingRequestCount: number;
}

const RequestStatusContext = createContext<RequestStatus>({ expirySecsLeft: null, pendingRequestCount: 0 });

export function RequestStatusProvider({ expirySecsLeft, pendingRequestCount, children }: RequestStatus & { children: ReactNode }) {
  return (
    <RequestStatusContext.Provider value={{ expirySecsLeft, pendingRequestCount }}>
      {children}
    </RequestStatusContext.Provider>
  );
}

export function useRequestStatus() {
  return useContext(RequestStatusContext);
}
