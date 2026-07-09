import type {
  RuntimeObservabilityAttributes,
  RuntimeObservabilityEvent,
} from "@azurite/shared";

import type { WebSentryConfig } from "../config/sentry-config.js";

type SentryScope = {
  setContext(name: string, context: Record<string, unknown>): void;
  setTag(name: string, value: string): void;
};

/** Minimal React SDK surface consumed by Azurite's browser runtime adapter. */
export type WebSentrySdk = {
  addBreadcrumb(breadcrumb: {
    readonly category: string;
    readonly data: Record<string, unknown>;
    readonly level: "error" | "info";
    readonly message: string;
  }): void;
  captureException(error: unknown): string;
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

type ActiveWebRuntime = {
  readonly config: WebSentryConfig;
  readonly sdk: WebSentrySdk;
};

let activeRuntime: ActiveWebRuntime | undefined;

/** Installs the browser SDK after its enabled-only dynamic initialization. */
export function installWebSentryRuntime(
  sdk: WebSentrySdk,
  config: WebSentryConfig,
): void {
  activeRuntime = { config, sdk };
}

/** Emits one structured browser runtime log and breadcrumb. */
export function recordWebRuntimeEvent(event: RuntimeObservabilityEvent): void {
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

/** Captures a real or deliberate browser runtime error with local context. */
export function captureWebRuntimeError(
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

/** Runs work inside a browser span when enabled and directly otherwise. */
export function runWebRuntimeSpan<Result>(
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

/** Clears module state between isolated browser runtime unit tests. */
export function resetWebSentryRuntimeForTests(): void {
  activeRuntime = undefined;
}

function createRuntimeAttributes(
  event: RuntimeObservabilityEvent,
  config: WebSentryConfig,
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
  config: WebSentryConfig,
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
