import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { viteConfiguration } from "./vite.config.js";

const qaRoot = new URL("./qa/route-transition/", import.meta.url);

export default defineConfig({
  ...viteConfiguration,
  build: {
    emptyOutDir: true,
    outDir: fileURLToPath(
      new URL("./dist/route-transition-qa/", import.meta.url),
    ),
  },
  preview: { host: "127.0.0.1", port: 4174 },
  publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
  root: fileURLToPath(qaRoot),
  server: { ...viteConfiguration.server, port: 5174 },
});
