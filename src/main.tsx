import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ApprovalWindow from "./approval-window";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@/styles/global.css";

document.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("error", (event) => {
  console.error("[glyph] window error:", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[glyph] unhandled rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("approval") === "1" || getCurrentWindow().label === "approval" ? (
      <ApprovalWindow />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
