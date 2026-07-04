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
const notifData = (window as any).__NOTIF_DATA__;
console.log("[main] __NOTIF_DATA__:", notifData);

if (notifData) {
  console.log("[main] rendering notification directly");
  alert("[main] __NOTIF_DATA__ found: " + JSON.stringify(notifData));
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <NotificationWindow data={notifData} />
  );
} else {
  console.log("[main] no __NOTIF_DATA__, rendering normal app");
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
