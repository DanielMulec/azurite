import { fileURLToPath } from "node:url";

import { createServer } from "vite";

import { registerWebDevShutdown } from "./web-dev-lifecycle.js";

const viteConfigFile = fileURLToPath(
  new URL("../vite.config.ts", import.meta.url),
);

const server = await createServer({ configFile: viteConfigFile });
registerWebDevShutdown(server);

await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
