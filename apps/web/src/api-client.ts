import {
  apiErrorResponseSchema,
  apiRoutes,
  correlationHeaderNames,
  createNoteContentRoute,
  createSaveNoteRoute,
  listNotesResponseSchema,
  readNoteResponseSchema,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeResultStatuses,
  runtimeSpanNames,
  runtimeSpanOperations,
  saveNoteResponseSchema,
  type ApiErrorCode,
  type ApiRequestMetadata,
  type ListNotesResponse,
  type ReadNoteResponse,
  type RuntimeObservabilityAttributes,
  type RuntimeObservabilityEvent,
  type SaveNoteInput,
  type SaveNoteResponse,
} from "@azurite/shared";
import type { z } from "zod";

import {
  captureWebRuntimeError,
  recordWebRuntimeEvent,
  runWebRuntimeSpan,
} from "./observability/web-runtime-observability.js";

type WebApiFailureKind = "api_response" | "invalid_response" | "network";
type WebApiErrorOptions = {
  readonly code?: ApiErrorCode;
  readonly failureKind?: WebApiFailureKind;
  readonly statusCode?: number;
};
type ApiRequestInput<Schema extends z.ZodType> = {
  readonly body?: string;
  readonly metadata: ApiRequestMetadata;
  readonly method: "GET" | "PUT";
  readonly requestPath: string;
  readonly routePattern: string;
  readonly schema: Schema;
};
type RequestLifecycle = {
  readonly startAttributes: RuntimeObservabilityAttributes;
  readonly startedAt: number;
};
type ApiEventInput = {
  readonly apiErrorCode?: ApiErrorCode;
  readonly attributes: RuntimeObservabilityAttributes;
  readonly metadata: ApiRequestMetadata;
  readonly name: string;
};

/** Error type used by the web app for safe user-facing API failures. */
export class WebApiError extends Error {
  readonly code: ApiErrorCode | undefined;
  readonly failureKind: WebApiFailureKind;
  readonly statusCode: number | undefined;

  constructor(message: string, options: WebApiErrorOptions = {}) {
    super(message);
    this.code = options.code;
    this.failureKind = options.failureKind ?? "invalid_response";
    this.statusCode = options.statusCode;
    this.name = "WebApiError";
  }
}

/** Lists note summaries from the configured local Azurite workspace. */
export function listNotes(
  metadata: ApiRequestMetadata,
): Promise<ListNotesResponse> {
  return requestJson({
    metadata,
    method: "GET",
    requestPath: apiRoutes.notes,
    routePattern: apiRoutes.notes,
    schema: listNotesResponseSchema,
  });
}

/** Reads one markdown note from the configured local Azurite workspace. */
export function readNote(
  noteId: string,
  metadata: ApiRequestMetadata,
): Promise<ReadNoteResponse> {
  return requestJson({
    metadata,
    method: "GET",
    requestPath: createNoteContentRoute(noteId),
    routePattern: apiRoutes.noteContent,
    schema: readNoteResponseSchema,
  });
}

/** Saves one existing markdown note through the local Azurite API. */
export function saveNote(
  input: SaveNoteInput,
  metadata: ApiRequestMetadata,
): Promise<SaveNoteResponse> {
  return requestJson({
    body: JSON.stringify(input),
    metadata,
    method: "PUT",
    requestPath: createSaveNoteRoute(),
    routePattern: apiRoutes.noteContent,
    schema: saveNoteResponseSchema,
  });
}

function requestJson<Schema extends z.ZodType>(
  input: ApiRequestInput<Schema>,
): Promise<z.infer<Schema>> {
  const startedAt = performance.now();
  const startAttributes = createRequestAttributes(
    input.metadata,
    input.method,
    input.routePattern,
  );
  recordWebRuntimeEvent(
    createApiEvent({
      attributes: startAttributes,
      metadata: input.metadata,
      name: runtimeObservabilityEventNames.apiRequestStarted,
    }),
  );

  return runWebRuntimeSpan(
    {
      attributes: startAttributes,
      name: runtimeObservabilityEventNames.apiRequestStarted,
      spanName: runtimeSpanNames.apiRequest,
      spanOperation: runtimeSpanOperations.apiRequest,
      surface: "web",
    },
    () => executeRequest(input, { startAttributes, startedAt }),
  );
}

async function executeRequest<Schema extends z.ZodType>(
  input: ApiRequestInput<Schema>,
  lifecycle: RequestLifecycle,
): Promise<z.infer<Schema>> {
  try {
    return await performRequest(input, lifecycle);
  } catch (error) {
    throw recordRequestFailure(error, input.metadata, lifecycle);
  }
}

async function performRequest<Schema extends z.ZodType>(
  input: ApiRequestInput<Schema>,
  lifecycle: RequestLifecycle,
): Promise<z.infer<Schema>> {
  const response = await fetchProductResponse(
    input.requestPath,
    createFetchRequest(input.body, input.method, input.metadata),
  );
  const parsedPayload = input.schema.safeParse(await parseResponse(response));
  if (!parsedPayload.success) {
    throw createInvalidPayloadError(response.status);
  }
  recordRequestSuccess(input.metadata, response.status, lifecycle);
  return parsedPayload.data;
}

function recordRequestSuccess(
  metadata: ApiRequestMetadata,
  statusCode: number,
  lifecycle: RequestLifecycle,
): void {
  recordWebRuntimeEvent(
    createApiEvent({
      attributes: {
        ...lifecycle.startAttributes,
        [runtimeObservabilityAttributeNames.durationMs]: elapsed(
          lifecycle.startedAt,
        ),
        [runtimeObservabilityAttributeNames.httpResponseStatusCode]: statusCode,
        [runtimeObservabilityAttributeNames.resultStatus]:
          runtimeResultStatuses.succeeded,
      },
      metadata,
      name: runtimeObservabilityEventNames.apiRequestSucceeded,
    }),
  );
}

function recordRequestFailure(
  error: unknown,
  metadata: ApiRequestMetadata,
  lifecycle: RequestLifecycle,
): WebApiError {
  const apiError = normalizeRequestError(error);
  const event = createApiEvent({
    apiErrorCode: apiError.code,
    attributes: {
      ...lifecycle.startAttributes,
      [runtimeObservabilityAttributeNames.apiErrorCode]: apiError.code,
      [runtimeObservabilityAttributeNames.durationMs]: elapsed(
        lifecycle.startedAt,
      ),
      [runtimeObservabilityAttributeNames.httpResponseStatusCode]:
        apiError.statusCode,
      [runtimeObservabilityAttributeNames.resultStatus]:
        runtimeResultStatuses.failed,
    },
    metadata,
    name: runtimeObservabilityEventNames.apiRequestFailed,
  });
  recordOwnedFailure(apiError, event);
  return apiError;
}

function recordOwnedFailure(
  apiError: WebApiError,
  event: RuntimeObservabilityEvent,
): void {
  if (apiError.failureKind === "api_response") {
    recordWebRuntimeEvent(event);
    return;
  }
  captureWebRuntimeError(apiError, event);
}

async function fetchProductResponse(
  path: string,
  request: RequestInit,
): Promise<Response> {
  try {
    return await fetch(path, request);
  } catch {
    throw new WebApiError("Could not reach the local Azurite server.", {
      failureKind: "network",
    });
  }
}

function createFetchRequest(
  body: string | undefined,
  method: "GET" | "PUT",
  metadata: ApiRequestMetadata,
): RequestInit {
  return {
    ...(body === undefined ? {} : { body, method }),
    headers: createRequestHeaders(body, metadata),
  };
}

function createRequestHeaders(
  body: string | undefined,
  metadata: ApiRequestMetadata,
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  addHeader(
    headers,
    "Content-Type",
    body === undefined ? undefined : "application/json",
  );
  addHeader(
    headers,
    correlationHeaderNames.noteOperationId,
    metadata.noteOperationId,
  );
  addHeader(headers, correlationHeaderNames.requestId, metadata.requestId);
  return headers;
}

function addHeader(
  headers: Record<string, string>,
  name: string,
  value: string | undefined,
): void {
  if (value !== undefined) {
    headers[name] = value;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw createInvalidPayloadError(response.status);
  }

  return parseResponsePayload(response, payload);
}

function parseResponsePayload(response: Response, payload: unknown): unknown {
  if (response.ok) {
    return payload;
  }

  const parsedError = apiErrorResponseSchema.safeParse(payload);
  if (parsedError.success) {
    throw new WebApiError(parsedError.data.error.message, {
      code: parsedError.data.error.code,
      failureKind: "api_response",
      statusCode: response.status,
    });
  }

  throw new WebApiError("Azurite returned an unexpected error response.", {
    failureKind: "invalid_response",
    statusCode: response.status,
  });
}

function createInvalidPayloadError(statusCode?: number): WebApiError {
  return new WebApiError("Azurite returned an unexpected response shape.", {
    failureKind: "invalid_response",
    ...(statusCode === undefined ? {} : { statusCode }),
  });
}

function normalizeRequestError(error: unknown): WebApiError {
  return error instanceof WebApiError
    ? error
    : new WebApiError("Could not reach the local Azurite server.", {
        failureKind: "network",
      });
}

function createRequestAttributes(
  metadata: ApiRequestMetadata,
  method: "GET" | "PUT",
  route: string,
): RuntimeObservabilityAttributes {
  return {
    [runtimeObservabilityAttributeNames.httpMethod]: method,
    [runtimeObservabilityAttributeNames.httpRoute]: route,
    [runtimeObservabilityAttributeNames.noteOperationId]:
      metadata.noteOperationId,
    [runtimeObservabilityAttributeNames.requestId]: metadata.requestId,
    [runtimeObservabilityAttributeNames.resultStatus]:
      runtimeResultStatuses.started,
  };
}

function createApiEvent(input: ApiEventInput): RuntimeObservabilityEvent {
  return {
    attributes: input.attributes,
    name: input.name,
    surface: "web" as const,
    tags: createApiTags(input),
  };
}

function createApiTags(input: ApiEventInput): Record<string, string> {
  const tags: Record<string, string> = {};
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.apiErrorCode,
    input.apiErrorCode,
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.httpRoute,
    input.attributes[runtimeObservabilityAttributeNames.httpRoute],
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.noteOperationId,
    input.metadata.noteOperationId,
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.requestId,
    input.metadata.requestId,
  );
  addStringTag(
    tags,
    runtimeObservabilityAttributeNames.resultStatus,
    input.attributes[runtimeObservabilityAttributeNames.resultStatus],
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

function elapsed(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
}
