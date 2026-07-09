import type { WebSentryConfig } from "../config/sentry-config.js";

type WebSentryRuntimeModule = {
  readonly initializeWebSentryRuntime: (
    config: WebSentryConfig,
  ) => Promise<void> | void;
};

type WebSentryRuntimeImporter = () => Promise<WebSentryRuntimeModule>;

const importWebSentryRuntime: WebSentryRuntimeImporter = () =>
  import("./web-sentry-runtime.js");

/** Initializes the browser SDK only for literal-true, DSN-backed config. */
export async function initializeWebSentry(
  config: WebSentryConfig,
  importRuntime: WebSentryRuntimeImporter = importWebSentryRuntime,
): Promise<boolean> {
  if (!config.enabled) {
    return false;
  }

  const runtime = await importRuntime();
  await runtime.initializeWebSentryRuntime(config);
  return true;
}
