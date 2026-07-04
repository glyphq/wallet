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

// Notification window: data injected via Rust initialization_script before React boots
const notifData = (window as any).__NOTIF_DATA__;
if (notifData) {
  console.log("[notif] rendering notification:", notifData);
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <NotificationWindow data={notifData} />
  );
} else {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
