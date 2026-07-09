import * as Sentry from "@sentry/react";

import {
  uncensoredReplayOptions,
  webTracePropagationTargets,
  type WebSentryConfig,
} from "../config/sentry-config.js";
import { installWebSentryRuntime } from "./web-runtime-observability.js";

/** Configures the dynamically loaded browser SDK before React renders. */
export function initializeWebSentryRuntime(config: WebSentryConfig): void {
  Sentry.init({
    dsn: config.dsn,
    enableLogs: true,
    environment: config.environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(uncensoredReplayOptions),
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
    release: config.release,
    replaysOnErrorSampleRate: config.replayErrorSampleRate,
    replaysSessionSampleRate: config.replaySessionSampleRate,
    tracePropagationTargets: [...webTracePropagationTargets],
    tracesSampleRate: config.traceSampleRate,
  });

  Sentry.setTag("app.surface", "web");
  Sentry.setContext("azurite.runtime", {
    environment: config.environment,
    release: config.release,
    surface: "web",
  });
  installWebSentryRuntime(Sentry, config);
}
