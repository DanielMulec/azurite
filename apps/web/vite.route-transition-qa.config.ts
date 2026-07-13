import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { viteConfiguration } from "./vite.config.js";

export default defineConfig({
  ...viteConfiguration,
  build: {
    outDir: "dist/route-transition-qa",
    rollupOptions: {
      input: fileURLToPath(
        new URL("./qa/route-transition/index.html", import.meta.url),
      ),
    },
  },
  preview: { host: "127.0.0.1", port: 4174 },
  server: { ...viteConfiguration.server, port: 5174 },
});
