import {
  runtimeObservabilityAttributeNames,
  runtimeSpanOperations,
  type ApiErrorCode,
  type RuntimeObservabilityAttributes,
  type RuntimeObservabilityEvent,
  type RuntimeSpanName,
} from "@azurite/shared";
import type { FastifyRequest } from "fastify";

import {
  captureServerRuntimeError,
  recordServerRuntimeEvent,
  runServerRuntimeSpan,
} from "./observability/server-runtime-observability.js";
import { getServerRequestCorrelation } from "./server-request-correlation.js";

type ServerRouteEvidence = {
  readonly attributes: RuntimeObservabilityAttributes;
  readonly eventName: string;
  readonly spanName: RuntimeSpanName;
};

/** Creates start-known note-route attributes from immutable request context. */
export function createServerRouteAttributes(
  request: FastifyRequest,
  method: "GET" | "PUT",
  route: string,
  attributes: RuntimeObservabilityAttributes = {},
): RuntimeObservabilityAttributes {
  const correlation = getServerRequestCorrelation(request);
  return {
    ...attributes,
    [runtimeObservabilityAttributeNames.httpMethod]: method,
    [runtimeObservabilityAttributeNames.httpRoute]: route,
    [runtimeObservabilityAttributeNames.noteOperationId]:
      correlation.noteOperationId,
    [runtimeObservabilityAttributeNames.noteOperationIdStatus]:
      correlation.noteOperationIdStatus,
    [runtimeObservabilityAttributeNames.requestId]: correlation.requestId,
    [runtimeObservabilityAttributeNames.requestIdSource]:
      correlation.requestIdSource,
  };
}

/** Emits one structured server route result, optionally owning its exception. */
export function recordServerRouteResult(
  request: FastifyRequest,
  eventName: string,
  attributes: RuntimeObservabilityAttributes,
  error?: unknown,
): void {
  const event = createEvent(request, eventName, attributes);
  if (error === undefined) {
    recordServerRuntimeEvent(event);
  } else {
    captureServerRuntimeError(error, event);
  }
}

/** Records a route start and measures its product work in a neutral span. */
export function runServerNoteRoute<Result>(
  request: FastifyRequest,
  evidence: ServerRouteEvidence,
  callback: () => Result,
): Result {
  recordServerRuntimeEvent(
    createEvent(request, evidence.eventName, evidence.attributes),
  );
  return runServerRuntimeSpan(
    {
      attributes: evidence.attributes,
      name: evidence.eventName,
      spanName: evidence.spanName,
      spanOperation: runtimeSpanOperations.serverRoute,
      surface: "server",
    },
    callback,
  );
}

/** Reads the stable API code from an existing safe error response. */
export function readSafeApiErrorCode(body: {
  readonly error: { readonly code: ApiErrorCode };
}): ApiErrorCode {
  return body.error.code;
}

function createEvent(
  request: FastifyRequest,
  name: string,
  attributes: RuntimeObservabilityAttributes,
): RuntimeObservabilityEvent {
  const correlation = getServerRequestCorrelation(request);
  const enrichedAttributes: RuntimeObservabilityAttributes = {
    [runtimeObservabilityAttributeNames.httpMethod]: request.method,
    [runtimeObservabilityAttributeNames.httpRoute]: request.routeOptions.url,
    [runtimeObservabilityAttributeNames.noteOperationId]:
      correlation.noteOperationId,
    [runtimeObservabilityAttributeNames.noteOperationIdStatus]:
      correlation.noteOperationIdStatus,
    [runtimeObservabilityAttributeNames.requestId]: correlation.requestId,
    [runtimeObservabilityAttributeNames.requestIdSource]:
      correlation.requestIdSource,
    ...attributes,
  };
  const apiCode =
    enrichedAttributes[runtimeObservabilityAttributeNames.apiErrorCode];
  const result =
    enrichedAttributes[runtimeObservabilityAttributeNames.resultStatus];
  const route =
    enrichedAttributes[runtimeObservabilityAttributeNames.httpRoute];
  return {
    attributes: enrichedAttributes,
    name,
    surface: "server",
    tags: {
      ...(typeof apiCode === "string"
        ? { [runtimeObservabilityAttributeNames.apiErrorCode]: apiCode }
        : {}),
      ...(typeof route === "string"
        ? { [runtimeObservabilityAttributeNames.httpRoute]: route }
        : {}),
      ...(correlation.noteOperationId === undefined
        ? {}
        : {
            [runtimeObservabilityAttributeNames.noteOperationId]:
              correlation.noteOperationId,
          }),
      [runtimeObservabilityAttributeNames.requestId]: correlation.requestId,
      ...(typeof result === "string"
        ? { [runtimeObservabilityAttributeNames.resultStatus]: result }
        : {}),
    },
  };
}
