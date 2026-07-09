import type {
  RuntimeObservabilityAttributes,
  RuntimeObservabilityEvent,
} from "@azurite/shared";

import type { ServerSentryConfig } from "../config/sentry-config.js";

type SentryScope = {
  setContext(name: string, context: Record<string, unknown>): void;
  setTag(name: string, value: string): void;
};

/** Minimal Node SDK surface consumed by Azurite's server runtime adapter. */
export type ServerSentrySdk = {
  addBreadcrumb(breadcrumb: {
    readonly category: string;
    readonly data: Record<string, unknown>;
    readonly level: "error" | "info";
    readonly message: string;
  }): void;
  captureException(error: unknown): string;
  flush(timeout?: number): Promise<boolean>;
  logger: {
    error(
      message: string,
      attributes?: Record<string, boolean | null | number | string>,
      metadata?: { readonly scope?: SentryScope },
    ): void;
    info(
      message: string,
      attributes?: Record<string, boolean | null | number | string>,
      metadata?: { readonly scope?: SentryScope },
    ): void;
  };
  startSpan<Result>(
    options: {
      readonly attributes: Record<string, boolean | number | string>;
      readonly name: string;
      readonly op: string;
    },
    callback: () => Result,
  ): Result;
  withScope(callback: (scope: SentryScope) => void): void;
};

type ActiveServerRuntime = {
  readonly config: ServerSentryConfig;
  readonly sdk: ServerSentrySdk;
};

let activeRuntime: ActiveServerRuntime | undefined;

/** Installs the SDK instance initialized by the early server preload. */
export function installServerSentryRuntime(
  sdk: ServerSentrySdk,
  config: ServerSentryConfig,
): void {
  activeRuntime = { config, sdk };
}

/** Reports whether the preload installed an enabled server runtime. */
export function isServerSentryRuntimeEnabled(): boolean {
  return activeRuntime?.config.enabled === true;
}

/** Emits one structured runtime log and chronological breadcrumb. */
export function recordServerRuntimeEvent(
  event: RuntimeObservabilityEvent,
): void {
  const runtime = activeRuntime;

  if (runtime === undefined) {
    return;
  }

  const attributes = createRuntimeAttributes(event, runtime.config);
  runtime.sdk.withScope((scope) => {
    applyEventScope(scope, event, attributes);
    runtime.sdk.logger.info(event.name, attributes, { scope });
    runtime.sdk.addBreadcrumb({
      category: "azurite.runtime",
      data: attributes,
      level: "info",
      message: event.name,
    });
  });
}

/** Captures a real or deliberate runtime error with event-local context. */
export function captureServerRuntimeError(
  error: unknown,
  event: RuntimeObservabilityEvent,
): void {
  const runtime = activeRuntime;

  if (runtime === undefined) {
    return;
  }

  const attributes = createRuntimeAttributes(event, runtime.config);
  runtime.sdk.withScope((scope) => {
    applyEventScope(scope, event, attributes);
    runtime.sdk.logger.error(event.name, attributes, { scope });
    runtime.sdk.captureException(error);
  });
}

/** Runs work inside a Sentry span when enabled and directly otherwise. */
export function runServerRuntimeSpan<Result>(
  event: RuntimeObservabilityEvent,
  callback: () => Result,
): Result {
  const runtime = activeRuntime;

  if (runtime === undefined) {
    return callback();
  }

  return runtime.sdk.startSpan(
    {
      attributes: createSpanAttributes(event, runtime.config),
      name: event.name,
      op: "azurite.runtime",
    },
    callback,
  );
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

function createRuntimeAttributes(
  event: RuntimeObservabilityEvent,
  config: ServerSentryConfig,
): Record<string, boolean | null | number | string> {
  return removeUndefinedAttributes({
    ...event.attributes,
    "app.surface": event.surface,
    "sentry.environment": config.environment,
    "sentry.release": config.release,
  });
}

function createSpanAttributes(
  event: RuntimeObservabilityEvent,
  config: ServerSentryConfig,
): Record<string, boolean | number | string> {
  const attributes = createRuntimeAttributes(event, config);

  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, boolean | number | string] =>
        entry[1] !== null,
    ),
  );
}

function removeUndefinedAttributes(
  attributes: RuntimeObservabilityAttributes,
): Record<string, boolean | null | number | string> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, boolean | null | number | string] =>
        entry[1] !== undefined,
    ),
  );
}

function applyEventScope(
  scope: SentryScope,
  event: RuntimeObservabilityEvent,
  attributes: Record<string, unknown>,
): void {
  scope.setTag("app.surface", event.surface);
  scope.setContext("azurite.runtime", attributes);
}
