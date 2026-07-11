import {
  correlationFailureReasons,
  correlationIdKinds,
  noteOperationIdSchema,
  requestIdSchema,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  type NoteOperationId,
  type RequestId,
} from "@azurite/shared";

import {
  captureWebRuntimeError,
  recordWebRuntimeEvent,
} from "./web-runtime-observability.js";

type CorrelationIdKind =
  (typeof correlationIdKinds)[keyof typeof correlationIdKinds];
type CorrelationId = NoteOperationId | RequestId;
type GenerationFailureReason =
  (typeof correlationFailureReasons)[keyof typeof correlationFailureReasons];
type GenerationResult =
  | { readonly id: CorrelationId }
  | { readonly error?: unknown; readonly reason?: GenerationFailureReason };

/** Generates one secure branded browser correlation ID without blocking work. */
export function createBrowserCorrelationId(
  kind: typeof correlationIdKinds.request,
): RequestId | undefined;
/** Generates one secure branded browser correlation ID without blocking work. */
export function createBrowserCorrelationId(
  kind: typeof correlationIdKinds.noteOperation,
): NoteOperationId | undefined;
export function createBrowserCorrelationId(
  kind: CorrelationIdKind,
): CorrelationId | undefined {
  const cryptoResult = readCryptoCapability();
  if (!("crypto" in cryptoResult)) {
    reportFailure(kind, cryptoResult.reason, cryptoResult.error);
    return undefined;
  }

  const nativeResult = tryNativeUuid(cryptoResult.crypto, kind);
  if ("id" in nativeResult) {
    return nativeResult.id;
  }

  const fallbackResult = trySecureByteFallback(cryptoResult.crypto, kind);
  return finishGeneration(kind, fallbackResult, nativeResult.error);
}

function readCryptoCapability():
  | { readonly crypto: Crypto }
  | { readonly error?: unknown; readonly reason: "crypto_unavailable" } {
  try {
    const crypto: unknown = Reflect.get(globalThis, "crypto");
    if (typeof crypto === "object" && crypto !== null) {
      return { crypto: crypto as Crypto };
    }
    return { reason: correlationFailureReasons.cryptoUnavailable };
  } catch (error) {
    return { error, reason: correlationFailureReasons.cryptoUnavailable };
  }
}

function tryNativeUuid(
  crypto: Crypto,
  kind: CorrelationIdKind,
): GenerationResult {
  try {
    const randomUUID: unknown = Reflect.get(crypto, "randomUUID");
    if (typeof randomUUID !== "function") {
      return {};
    }
    const candidate: unknown = Reflect.apply(randomUUID, crypto, []);
    return typeof candidate === "string"
      ? parsedResult(kind, candidate)
      : {};
  } catch (error) {
    return { error };
  }
}

function trySecureByteFallback(
  crypto: Crypto,
  kind: CorrelationIdKind,
): GenerationResult {
  let getRandomValues: unknown;
  try {
    getRandomValues = Reflect.get(crypto, "getRandomValues");
  } catch (error) {
    return {
      error,
      reason: correlationFailureReasons.randomValuesFailed,
    };
  }
  if (typeof getRandomValues !== "function") {
    return { reason: correlationFailureReasons.randomValuesUnavailable };
  }
  return invokeSecureByteFallback(crypto, getRandomValues, kind);
}

function invokeSecureByteFallback(
  crypto: Crypto,
  getRandomValues: (...arguments_: unknown[]) => unknown,
  kind: CorrelationIdKind,
): GenerationResult {
  try {
    const bytes = Reflect.apply(getRandomValues, crypto, [new Uint8Array(16)]);
    return createFallbackId(bytes, kind);
  } catch (error) {
    return {
      error,
      reason: correlationFailureReasons.randomValuesFailed,
    };
  }
}

function createFallbackId(
  value: unknown,
  kind: CorrelationIdKind,
): GenerationResult {
  if (!(value instanceof Uint8Array) || value.length !== 16) {
    return { reason: correlationFailureReasons.uuidInvalid };
  }
  value[6] = ((value[6] ?? 0) & 0x0f) | 0x40;
  value[8] = ((value[8] ?? 0) & 0x3f) | 0x80;
  const result = parsedResult(kind, formatUuid(value));
  return "id" in result
    ? result
    : { reason: correlationFailureReasons.uuidInvalid };
}

function finishGeneration(
  kind: CorrelationIdKind,
  fallback: GenerationResult,
  nativeError: unknown,
): CorrelationId | undefined {
  if ("id" in fallback) {
    return fallback.id;
  }
  const reason =
    fallback.reason ?? correlationFailureReasons.randomValuesUnavailable;
  reportFailure(kind, reason, fallback.error ?? nativeError);
  return undefined;
}

function parsedResult(
  kind: CorrelationIdKind,
  candidate: string,
): GenerationResult {
  const result =
    kind === correlationIdKinds.request
      ? requestIdSchema.safeParse(candidate)
      : noteOperationIdSchema.safeParse(candidate);
  return result.success ? { id: result.data } : {};
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function reportFailure(
  kind: CorrelationIdKind,
  reason: GenerationFailureReason,
  error?: unknown,
): void {
  const event = {
    attributes: {
      [runtimeObservabilityAttributeNames.correlationFailureReason]: reason,
      [runtimeObservabilityAttributeNames.correlationIdKind]: kind,
    },
    name: runtimeObservabilityEventNames.correlationIdGenerationFailed,
    surface: "web",
  } as const;
  if (error === undefined) {
    recordWebRuntimeEvent(event);
    return;
  }
  captureWebRuntimeError(error, event);
}
