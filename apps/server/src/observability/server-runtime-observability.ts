import {
  captureFailOpenRuntimeError,
  recordFailOpenRuntimeEvent,
  runFailOpenRuntimeCarrierSpan,
  type FailOpenRuntimeCarrier,
  type RuntimeObservabilityCarrierCallbacks,
  type RuntimeObservabilityEvent,
} from "@azurite/shared";

import type { ServerSentryConfig } from "../config/sentry-config.js";

/** Minimal Node SDK surface consumed by Azurite's server runtime adapter. */
export type ServerSentrySdk = RuntimeObservabilityCarrierCallbacks & {
  flush(timeout?: number): Promise<boolean>;
};

type ActiveServerRuntime = {
  readonly carrier: FailOpenRuntimeCarrier;
  readonly config: ServerSentryConfig;
  readonly sdk: ServerSentrySdk;
};

let activeRuntime: ActiveServerRuntime | undefined;

/** Installs the SDK instance initialized by the early server preload. */
export function installServerSentryRuntime(
  sdk: ServerSentrySdk,
  config: ServerSentryConfig,
): void {
  activeRuntime = {
    carrier: {
      callbacks: sdk,
      environment: config.environment,
      release: config.release,
    },
    config,
    sdk,
  };
}

/** Reports whether the preload installed an enabled server runtime. */
export function isServerSentryRuntimeEnabled(): boolean {
  return activeRuntime?.config.enabled === true;
}

/** Emits one structured runtime log and chronological breadcrumb. */
export function recordServerRuntimeEvent(
  event: RuntimeObservabilityEvent,
): void {
  recordFailOpenRuntimeEvent(activeRuntime?.carrier, event);
}

/** Captures a real or deliberate runtime error with event-local context. */
export function captureServerRuntimeError(
  error: unknown,
  event: RuntimeObservabilityEvent,
): void {
  captureFailOpenRuntimeError(activeRuntime?.carrier, error, event);
}

/** Runs work inside a Sentry span when enabled and directly otherwise. */
export function runServerRuntimeSpan<Result>(
  event: RuntimeObservabilityEvent,
  callback: () => Result,
): Result {
  return runFailOpenRuntimeCarrierSpan(activeRuntime?.carrier, event, callback);
}

/** Flushes queued server telemetry within the caller-provided budget. */
export async function flushServerSentry(timeoutMs: number): Promise<boolean> {
  const runtime = activeRuntime;

  return runtime === undefined ? true : runtime.sdk.flush(timeoutMs);
}

/** Clears module state between isolated runtime unit tests. */
export function resetServerSentryRuntimeForTests(): void {
  activeRuntime = undefined;
}
