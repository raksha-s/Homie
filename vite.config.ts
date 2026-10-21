import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// Shown at the bottom of the app so you can tell which version a phone is running.
const build = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

// The app is served from https://raksha-s.github.io/Homie/, so every asset lives under /Homie/.
const base = "/Homie/";

export default defineConfig({
  base,
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Homie",
        short_name: "Homie",
        description: "Personal house management: tasks, meals, restocking and expenses.",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#f4f6f5",
        theme_color: "#0f766e",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
