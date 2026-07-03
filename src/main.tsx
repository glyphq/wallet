import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/styles/global.css";

document.documentElement.setAttribute("data-theme", "dark");
document.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("error", (event) => {
  console.error("[glyph] window error:", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[glyph] unhandled rejection:", event.reason);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
