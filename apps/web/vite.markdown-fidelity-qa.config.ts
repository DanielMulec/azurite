import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { viteConfiguration } from "./vite.config.js";

const qaRoot = new URL("./qa/markdown-fidelity/", import.meta.url);

export default defineConfig({
  ...viteConfiguration,
  build: {
    emptyOutDir: true,
    outDir: fileURLToPath(
      new URL("./dist/markdown-fidelity-qa/", import.meta.url),
    ),
  },
  preview: { host: "127.0.0.1", port: 4175 },
  publicDir: false,
  root: fileURLToPath(qaRoot),
  server: { ...viteConfiguration.server, port: 5175 },
});
