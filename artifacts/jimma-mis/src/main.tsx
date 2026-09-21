import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initMockAdapter } from "./lib/mock-data-adapter";

initMockAdapter();

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  const base = import.meta.env.BASE_URL;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch(() => {});
  });
}
