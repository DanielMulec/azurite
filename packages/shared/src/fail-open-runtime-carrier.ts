import type {
  RuntimeCaughtErrorContext,
  RuntimeObservabilityAttributes,
  RuntimeObservabilityEvent,
} from "./runtime-observability.js";
import { runFailOpenRuntimeSpan } from "./runtime-observability.js";

type RuntimeCarrierAttributes = Record<
  string,
  boolean | null | number | string
>;
type RuntimeSpanCarrierAttributes = Record<string, boolean | number | string>;
type RuntimeErrorDelivery = {
  readonly attributes: RuntimeCarrierAttributes;
  readonly callbacks: RuntimeObservabilityCarrierCallbacks;
  readonly error: unknown;
  readonly event: RuntimeObservabilityEvent;
};

/** Event-local scope operations required by the fail-open carrier. */
export type RuntimeObservabilityScopeCarrier = {
  setContext(name: string, context: Record<string, unknown>): void;
  setTag(name: string, value: string): void;
};

/** Minimal Sentry-free callback surface required to deliver runtime evidence. */
export type RuntimeObservabilityCarrierCallbacks = {
  addBreadcrumb(breadcrumb: {
    readonly category: string;
    readonly data: Record<string, unknown>;
    readonly level: "error" | "info";
    readonly message: string;
  }): void;
  captureException(error: unknown): unknown;
  logger: {
    error(
      message: string,
      attributes?: RuntimeCarrierAttributes,
      metadata?: { readonly scope?: RuntimeObservabilityScopeCarrier },
    ): void;
    info(
      message: string,
      attributes?: RuntimeCarrierAttributes,
      metadata?: { readonly scope?: RuntimeObservabilityScopeCarrier },
    ): void;
  };
  startSpan<Result>(
    options: {
      readonly attributes: RuntimeSpanCarrierAttributes;
      readonly name: string;
      readonly op: string;
    },
    callback: () => Result,
  ): Result;
  withScope(callback: (scope: RuntimeObservabilityScopeCarrier) => void): void;
};

/** Stateless delivery input assembled by each surface's local runtime owner. */
export type FailOpenRuntimeCarrier = {
  readonly callbacks: RuntimeObservabilityCarrierCallbacks;
  readonly environment: string;
  readonly release: string;
};

/** Records one structured event and breadcrumb without affecting product work. */
export function recordFailOpenRuntimeEvent(
  carrier: FailOpenRuntimeCarrier | undefined,
  event: RuntimeObservabilityEvent,
): void {
  if (carrier === undefined) {
    return;
  }

  const attributes = createRuntimeAttributes(event, carrier);
  const usedScope = tryWithScope(carrier.callbacks, (scope) => {
    applyEventScope(scope, event, attributes);
    bestEffort(() => {
      carrier.callbacks.logger.info(event.name, attributes, { scope });
    });
  });
  if (!usedScope) {
    bestEffort(() => {
      carrier.callbacks.logger.info(event.name, attributes);
    });
  }
  bestEffort(() => {
    carrier.callbacks.addBreadcrumb({
      category: "azurite.runtime",
      data: attributes,
      level: "info",
      message: event.name,
    });
  });
}

/** Captures one error with normalized local context and fail-open fallback. */
export function captureFailOpenRuntimeError(
  carrier: FailOpenRuntimeCarrier | undefined,
  error: unknown,
  event: RuntimeObservabilityEvent,
): void {
  if (carrier === undefined) {
    return;
  }

  const attributes = createRuntimeAttributes(event, carrier);
  const errorContext = createCaughtErrorContext(error);
  const delivery = {
    attributes,
    callbacks: carrier.callbacks,
    error,
    event,
  } satisfies RuntimeErrorDelivery;
  const usedScope = tryWithScope(carrier.callbacks, (scope) => {
    applyEventScope(scope, event, attributes);
    bestEffort(() => {
      scope.setContext("azurite.error", { ...errorContext });
    });
    recordErrorWithScope(delivery, scope);
  });
  if (!usedScope) {
    recordErrorWithoutScope(delivery);
  }
}

/** Runs product work through the optional carrier while preserving its outcome. */
export function runFailOpenRuntimeCarrierSpan<Result>(
  carrier: FailOpenRuntimeCarrier | undefined,
  event: RuntimeObservabilityEvent,
  callback: () => Result,
): Result {
  if (carrier === undefined) {
    return callback();
  }

  return runFailOpenRuntimeSpan(
    (guardedCallback) =>
      carrier.callbacks.startSpan(
        {
          attributes: createSpanAttributes(event, carrier),
          name: event.spanName ?? event.name,
          op: event.spanOperation ?? "azurite.runtime",
        },
        guardedCallback,
      ),
    callback,
  );
}

function recordErrorWithScope(
  delivery: RuntimeErrorDelivery,
  scope: RuntimeObservabilityScopeCarrier,
): void {
  bestEffort(() => {
    delivery.callbacks.logger.error(delivery.event.name, delivery.attributes, {
      scope,
    });
  });
  bestEffort(() => {
    delivery.callbacks.captureException(delivery.error);
  });
}

function recordErrorWithoutScope(delivery: RuntimeErrorDelivery): void {
  bestEffort(() => {
    delivery.callbacks.logger.error(delivery.event.name, delivery.attributes);
  });
  bestEffort(() => {
    delivery.callbacks.captureException(delivery.error);
  });
}

function createRuntimeAttributes(
  event: RuntimeObservabilityEvent,
  carrier: FailOpenRuntimeCarrier,
): RuntimeCarrierAttributes {
  return removeUndefinedAttributes({
    ...event.attributes,
    "app.surface": event.surface,
    "sentry.environment": carrier.environment,
    "sentry.release": carrier.release,
  });
}

function createSpanAttributes(
  event: RuntimeObservabilityEvent,
  carrier: FailOpenRuntimeCarrier,
): RuntimeSpanCarrierAttributes {
  const attributes = createRuntimeAttributes(event, carrier);

  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, boolean | number | string] =>
        entry[1] !== null,
    ),
  );
}

function removeUndefinedAttributes(
  attributes: RuntimeObservabilityAttributes,
): RuntimeCarrierAttributes {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, boolean | null | number | string] =>
        entry[1] !== undefined,
    ),
  );
}

function applyEventScope(
  scope: RuntimeObservabilityScopeCarrier,
  event: RuntimeObservabilityEvent,
  attributes: Record<string, unknown>,
): void {
  bestEffort(() => {
    scope.setTag("app.surface", event.surface);
  });
  for (const [name, value] of Object.entries(event.tags ?? {})) {
    bestEffort(() => {
      scope.setTag(name, value);
    });
  }
  bestEffort(() => {
    scope.setContext("azurite.runtime", attributes);
  });
}

function createCaughtErrorContext(error: unknown): RuntimeCaughtErrorContext {
  try {
    return createCaughtErrorContextUnsafe(error);
  } catch {
    return {
      message: "A non-Error value was thrown.",
      name: "UnknownError",
    };
  }
}

function createCaughtErrorContextUnsafe(
  error: unknown,
): RuntimeCaughtErrorContext {
  if (!(error instanceof Error)) {
    return {
      message: "A non-Error value was thrown.",
      name: "UnknownError",
    };
  }

  const code = readErrorCode(error);
  const context = addErrorCode(
    {
      message: error.message,
      name: error.name,
    },
    code,
  );
  return addErrorStack(context, error.stack);
}

function addErrorCode(
  context: RuntimeCaughtErrorContext,
  code: string | undefined,
): RuntimeCaughtErrorContext {
  return code === undefined ? context : { ...context, code };
}

function addErrorStack(
  context: RuntimeCaughtErrorContext,
  stack: string | undefined,
): RuntimeCaughtErrorContext {
  return stack === undefined ? context : { ...context, stack };
}

function readErrorCode(error: Error): string | undefined {
  try {
    const code = (error as Error & { readonly code?: unknown }).code;
    return normalizeErrorCode(code);
  } catch {
    return undefined;
  }
}

function normalizeErrorCode(code: unknown): string | undefined {
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number") {
    return String(code);
  }
  return undefined;
}

function tryWithScope(
  callbacks: RuntimeObservabilityCarrierCallbacks,
  callback: (scope: RuntimeObservabilityScopeCarrier) => void,
): boolean {
  let invoked = false;
  try {
    callbacks.withScope((scope) => {
      invoked = true;
      callback(scope);
    });
  } catch {
    // The caller falls back only when the carrier never supplied a local scope.
  }
  return invoked;
}

function bestEffort(callback: () => void): void {
  try {
    callback();
  } catch {
    // Observability is diagnostic infrastructure and must fail open.
  }
}
