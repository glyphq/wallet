import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll("\\", "/");
          if (!moduleId.includes("/node_modules/")) return undefined;

          const inPackage = (pkg: string) =>
            moduleId.includes(`/node_modules/${pkg}/`);

          if (inPackage("react") || inPackage("react-dom") || inPackage("scheduler")) return "react-vendor";
          if (inPackage("react-router") || inPackage("react-router-dom") || inPackage("@remix-run/router")) return "router-vendor";
          if (inPackage("@tanstack/react-query") || inPackage("zustand") || inPackage("react-hook-form") || inPackage("zod")) return "state-vendor";
          if (moduleId.includes("/node_modules/@tauri-apps/")) return "tauri-vendor";
          if (moduleId.includes("/node_modules/@qubic.org/")) return "qubic-vendor";
          if (inPackage("motion") || inPackage("@solar-icons/react") || inPackage("qrcode.react")) return "ui-vendor";
          return "vendor";
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
