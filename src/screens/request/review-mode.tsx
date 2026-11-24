import { createContext, useContext, type ReactNode } from "react";

const ReviewModeContext = createContext({ approvalWindow: false });

/** Distinguishes the isolated dApp review window from the main wallet surface. */
export function ReviewModeProvider({ approvalWindow, children }: { approvalWindow: boolean; children: ReactNode }) {
  return (
    <ReviewModeContext.Provider value={{ approvalWindow }}>
      {children}
    </ReviewModeContext.Provider>
  );
}

export function useReviewMode() {
  return useContext(ReviewModeContext);
}
