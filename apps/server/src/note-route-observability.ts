import {
  runtimeObservabilityAttributeNames,
  runtimeSpanOperations,
  type ApiErrorCode,
  type ClusterIdentity,
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
type ServerRouteStart = {
  readonly attributes?: RuntimeObservabilityAttributes;
  readonly method: "GET" | "PUT";
  readonly request: FastifyRequest;
  readonly route: string;
};
type ServerRouteResult = {
  readonly attributes: RuntimeObservabilityAttributes;
  readonly error?: unknown;
  readonly eventName: string;
  readonly request: FastifyRequest;
};
type ServerTerminalInput = {
  readonly attributes?: RuntimeObservabilityAttributes;
  readonly resultStatus: string;
  readonly startedAt: number;
  readonly statusCode: number;
};

/** Creates start-known note-route attributes from immutable request context. */
export function createServerRouteAttributes(
  input: ServerRouteStart,
): RuntimeObservabilityAttributes {
  const correlation = getServerRequestCorrelation(input.request);
  return {
    ...input.attributes,
    [runtimeObservabilityAttributeNames.httpMethod]: input.method,
    [runtimeObservabilityAttributeNames.httpRoute]: input.route,
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
export function recordServerRouteResult(input: ServerRouteResult): void {
  const event = createEvent(input.request, input.eventName, input.attributes);
  if (input.error === undefined) {
    recordServerRuntimeEvent(event);
  } else {
    captureServerRuntimeError(input.error, event);
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

/** Creates terminal route attributes with elapsed duration and status. */
export function createServerTerminalAttributes(
  input: ServerTerminalInput,
): RuntimeObservabilityAttributes {
  return {
    ...input.attributes,
    [runtimeObservabilityAttributeNames.durationMs]: Math.max(
      0,
      performance.now() - input.startedAt,
    ),
    [runtimeObservabilityAttributeNames.httpResponseStatusCode]:
      input.statusCode,
    [runtimeObservabilityAttributeNames.resultStatus]: input.resultStatus,
  };
}

/** Converts cluster identity state into stable route attributes. */
export function createClusterAttributes(
  identity: ClusterIdentity,
): RuntimeObservabilityAttributes {
  return identity.status === "ready"
    ? {
        [runtimeObservabilityAttributeNames.clusterId]: identity.clusterId,
        [runtimeObservabilityAttributeNames.clusterIdentityStatus]:
          identity.status,
      }
    : {
        [runtimeObservabilityAttributeNames.clusterIdentityReason]:
          identity.reason,
        [runtimeObservabilityAttributeNames.clusterIdentityStatus]:
          identity.status,
      };
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
  return {
    attributes: enrichedAttributes,
    name,
    surface: "server",
    tags: createEventTags(enrichedAttributes, correlation),
  };
}

function createEventTags(
  attributes: RuntimeObservabilityAttributes,
  correlation: ReturnType<typeof getServerRequestCorrelation>,
): Record<string, string> {
  const tags = {
    [runtimeObservabilityAttributeNames.requestId]: correlation.requestId,
  };
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.apiErrorCode,
    attributes[runtimeObservabilityAttributeNames.apiErrorCode],
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.httpRoute,
    attributes[runtimeObservabilityAttributeNames.httpRoute],
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.noteOperationId,
    correlation.noteOperationId,
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.resultStatus,
    attributes[runtimeObservabilityAttributeNames.resultStatus],
  );
  return tags;
}

function addStringTag(
  tags: Record<string, string>,
  key: string,
  value: unknown,
): void {
  if (typeof value === "string") {
    tags[key] = value;
  }
}
