// This ESM preload is the required exception to Azurite's TypeScript-only
// utility rule: Node must execute it before the TypeScript Fastify graph.
const { loadRootLocalEnvironment } =
  await import("./config/root-environment.js");
loadRootLocalEnvironment();

const { readServerSentryConfig } = await import("./config/sentry-config.js");
const sentryConfig = readServerSentryConfig();
const preloadState = {
  fastifyIntegrationConfigured: false,
  runtimeContextConfigured: false,
  sdkImported: false,
  sentryEnabled: sentryConfig.enabled,
};
globalThis[Symbol.for("azurite.sentry.preload-state")] = preloadState;

if (sentryConfig.enabled) {
  const Sentry = await import("@sentry/node");
  preloadState.sdkImported = true;

  Sentry.init({
    dsn: sentryConfig.dsn,
    enableLogs: true,
    environment: sentryConfig.environment,
    integrations: [
      Sentry.fastifyIntegration({
        shouldHandleError(_error, _request, reply) {
          return reply.statusCode >= 500;
        },
      }),
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
    release: sentryConfig.release,
    tracesSampleRate: sentryConfig.traceSampleRate,
  });
  preloadState.fastifyIntegrationConfigured = true;

  Sentry.setTag("app.surface", "server");
  Sentry.setContext("azurite.runtime", {
    environment: sentryConfig.environment,
    release: sentryConfig.release,
    surface: "server",
  });
  preloadState.runtimeContextConfigured = true;

  const { installServerSentryRuntime } =
    await import("./observability/server-runtime-observability.js");
  installServerSentryRuntime(Sentry, sentryConfig);
}
