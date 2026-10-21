import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { registerSW } from "virtual:pwa-register";
import "./index.css";

// HashRouter keeps refreshes working on GitHub Pages, which has no server-side routing.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);

// Pick up new versions without the user doing anything: check on load and whenever the app
// comes back to the foreground, then reload into the new build.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void registration.update();
    });
  },
});
