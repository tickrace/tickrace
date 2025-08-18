

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/leaflet.css";
import { UserProvider } from "./contexts/UserContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
);
// --- DEBUG GLOBAL (à laisser provisoirement) ---
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    console.error("🌶️ window.error:", e?.error || e?.message || e);
    const el = document.getElementById("global-error-log") || (() => {
      const n = document.createElement("div");
      n.id = "global-error-log";
      n.style.position = "fixed";
      n.style.bottom = "8px";
      n.style.left = "8px";
      n.style.zIndex = "99999";
      n.style.maxWidth = "60vw";
      n.style.background = "rgba(0,0,0,.8)";
      n.style.color = "#fff";
      n.style.font = "12px/1.4 ui-monospace,Consolas,monospace";
      n.style.padding = "8px 10px";
      n.style.borderRadius = "8px";
      n.style.whiteSpace = "pre-wrap";
      document.body.appendChild(n);
      return n;
    })();
    el.textContent = "[window.error] " + String(e?.error?.message || e?.message || e);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("🌶️ unhandledrejection:", e?.reason || e);
    const el = document.getElementById("global-error-log") || (() => {
      const n = document.createElement("div");
      n.id = "global-error-log";
      n.style.position = "fixed";
      n.style.bottom = "8px";
      n.style.left = "8px";
      n.style.zIndex = "99999";
      n.style.maxWidth = "60vw";
      n.style.background = "rgba(0,0,0,.8)";
      n.style.color = "#fff";
      n.style.font = "12px/1.4 ui-monospace,Consolas,monospace";
      n.style.padding = "8px 10px";
      n.style.borderRadius = "8px";
      n.style.whiteSpace = "pre-wrap";
      document.body.appendChild(n);
      return n;
    })();
    el.textContent = "[unhandledrejection] " + String(e?.reason?.message || e?.reason || e);
  });
}
