import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import NotificationWindow from "@/screens/notification/notification-window";
import "@/styles/global.css";

document.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("error", (event) => {
  console.error("[glyph] window error:", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[glyph] unhandled rejection:", event.reason);
});

// Check if this is a notification window (data injected by Rust before React boots)
const notifData = (window as any).__NOTIF_DATA__ as { kind: string; title: string; body: string; duration: number } | undefined;

if (notifData) {
  console.log("[notif] __NOTIF_DATA__ found, rendering notification directly:", notifData);
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <NotificationWindow data={notifData as any} />
  );
} else {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
