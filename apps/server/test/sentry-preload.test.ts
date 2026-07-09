import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const tsxExecutable = fileURLToPath(
  new URL("../../../node_modules/.bin/tsx", import.meta.url),
);
const statePrefix = "AZURITE_PRELOAD_STATE=";
const stateProbe = [
  "import('fastify').then(() => {",
  "const state = globalThis[Symbol.for('azurite.sentry.preload-state')];",
  `console.log('${statePrefix}' + JSON.stringify(state));`,
  "});",
].join("");

describe("custom server Sentry preload", () => {
  it("is wired into both real tsx startup scripts", async () => {
    const packageJson = await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    );

    expect(packageJson).toContain(
      "tsx --import ./src/sentry-preload.mjs src/index.ts",
    );
  });

  it("does not import or initialize the SDK when disabled", async () => {
    const state = await runPreloadProbe({
      SENTRY_DSN: "",
      SENTRY_ENABLED: "false",
    });

    expect(state).toEqual({
      fastifyIntegrationConfigured: false,
      sdkImported: false,
      sentryEnabled: false,
    });
  });

  it("imports and configures Fastify instrumentation before Fastify when enabled", async () => {
    const state = await runPreloadProbe({
      SENTRY_DSN: "https://public@example.invalid/1",
      SENTRY_ENABLED: "true",
      SENTRY_TRACE_SAMPLE_RATE: "0",
    });

    expect(state).toEqual({
      fastifyIntegrationConfigured: true,
      sdkImported: true,
      sentryEnabled: true,
    });
  });
});

async function runPreloadProbe(
  environment: NodeJS.ProcessEnv,
): Promise<Record<string, boolean>> {
  const { stdout } = await execFileAsync(
    tsxExecutable,
    ["--import", "./src/sentry-preload.mjs", "--eval", stateProbe],
    {
      cwd: serverRoot,
      env: { ...process.env, ...environment },
    },
  );
  const stateLine = stdout
    .split("\n")
    .find((line) => line.startsWith(statePrefix));

  if (stateLine === undefined) {
    throw new Error(`Preload state was not reported. Output: ${stdout}`);
  }

  return JSON.parse(stateLine.slice(statePrefix.length)) as Record<
    string,
    boolean
  >;
}
