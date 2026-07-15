import {
  captureFailOpenRuntimeError,
  recordFailOpenRuntimeEvent,
  runFailOpenRuntimeCarrierSpan,
  type FailOpenRuntimeCarrier,
  type RuntimeObservabilityCarrierCallbacks,
  type RuntimeObservabilityEvent,
} from "@azurite/shared";

import type { WebSentryConfig } from "../config/sentry-config.js";

/** Minimal React SDK surface consumed by Azurite's browser runtime adapter. */
export type WebSentrySdk = RuntimeObservabilityCarrierCallbacks;

type ActiveWebRuntime = {
  readonly carrier: FailOpenRuntimeCarrier;
};

let activeRuntime: ActiveWebRuntime | undefined;

/** Installs the browser SDK after its enabled-only dynamic initialization. */
export function installWebSentryRuntime(
  sdk: WebSentrySdk,
  config: WebSentryConfig,
): void {
  activeRuntime = {
    carrier: {
      callbacks: sdk,
      environment: config.environment,
      release: config.release,
    },
  };
}

/** Emits one structured browser runtime log and breadcrumb. */
export function recordWebRuntimeEvent(event: RuntimeObservabilityEvent): void {
  recordFailOpenRuntimeEvent(activeRuntime?.carrier, event);
}

/** Captures a real or deliberate browser runtime error with local context. */
export function captureWebRuntimeError(
  error: unknown,
  event: RuntimeObservabilityEvent,
): void {
  captureFailOpenRuntimeError(activeRuntime?.carrier, error, event);
}

/** Runs work inside a browser span when enabled and directly otherwise. */
export function runWebRuntimeSpan<Result>(
  event: RuntimeObservabilityEvent,
  callback: () => Result,
): Result {
  return runFailOpenRuntimeCarrierSpan(activeRuntime?.carrier, event, callback);
}

/** Clears module state between isolated browser runtime unit tests. */
export function resetWebSentryRuntimeForTests(): void {
  activeRuntime = undefined;
}
