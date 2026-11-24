import { useState } from "react";
import { Button } from "@/components/button";

/** Development-only control that throws during render to exercise ErrorBoundary. */
export function ErrorProbe() {
  const [armed, setArmed] = useState(false);

  if (armed) {
    throw new Error("Test error: the error boundary is working.");
  }

  return (
    <Button variant="ghost" size="sm" style={{ width: "100%" }} onClick={() => setArmed(true)}>
      Trigger test error
    </Button>
  );
}
