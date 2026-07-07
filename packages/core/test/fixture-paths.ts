import { fileURLToPath } from "node:url";

export const fixtureWorkspacePath = fileURLToPath(
  new URL("./fixtures/workspace", import.meta.url),
);
