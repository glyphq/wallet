import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@/styles/global.css";

document.documentElement.setAttribute("data-theme", "dark");
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
