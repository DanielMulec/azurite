import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type UserConfig } from "vite";

const localApiServer = "http://127.0.0.1:3000";
export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

export const viteConfiguration = {
  envDir: repositoryRoot,
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": localApiServer,
      "/__azurite/dev/sentry-test-event": localApiServer,
      "/health": localApiServer,
    },
  },
} satisfies UserConfig;

export default defineConfig(viteConfiguration);
