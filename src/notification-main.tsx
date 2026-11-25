import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles/global.css";
import { NotificationOverlay } from "@/screens/notification-overlay";

document.documentElement.style.background = "transparent";
document.body.style.background = "transparent";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NotificationOverlay />
  </React.StrictMode>,
);
