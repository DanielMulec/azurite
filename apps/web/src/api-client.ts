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
  return requestJson(apiRoutes.notes, "GET", metadata, listNotesResponseSchema);
}

/** Reads one markdown note from the configured local Azurite workspace. */
export function readNote(
  noteId: string,
  metadata: ApiRequestMetadata,
): Promise<ReadNoteResponse> {
  return requestJson(
    createNoteContentRoute(noteId),
    "GET",
    metadata,
    readNoteResponseSchema,
    apiRoutes.noteContent,
  );
}

/** Saves one existing markdown note through the local Azurite API. */
export function saveNote(
  input: SaveNoteInput,
  metadata: ApiRequestMetadata,
): Promise<SaveNoteResponse> {
  return requestJson(
    createSaveNoteRoute(),
    "PUT",
    metadata,
    saveNoteResponseSchema,
    apiRoutes.noteContent,
    JSON.stringify(input),
  );
}

function requestJson<Schema extends z.ZodType>(
  requestPath: string,
  method: "GET" | "PUT",
  metadata: ApiRequestMetadata,
  schema: Schema,
  routePattern = requestPath,
  body?: string,
): Promise<z.infer<Schema>> {
  const startedAt = performance.now();
  const startAttributes = createRequestAttributes(
    metadata,
    method,
    routePattern,
  );
  recordWebRuntimeEvent(
    createApiEvent(
      runtimeObservabilityEventNames.apiRequestStarted,
      startAttributes,
      metadata,
    ),
  );

  return runWebRuntimeSpan(
    {
      attributes: startAttributes,
      name: runtimeObservabilityEventNames.apiRequestStarted,
      spanName: runtimeSpanNames.apiRequest,
      spanOperation: runtimeSpanOperations.apiRequest,
      surface: "web",
    },
    async () => {
      try {
        const response = await fetchProductResponse(
          requestPath,
          createFetchRequest(body, method, metadata),
        );
        const payload = await parseResponse(response);
        const parsedPayload = schema.safeParse(payload);

        if (!parsedPayload.success) {
          throw createInvalidPayloadError(response.status);
        }

        recordWebRuntimeEvent(
          createApiEvent(
            runtimeObservabilityEventNames.apiRequestSucceeded,
            {
              ...startAttributes,
              [runtimeObservabilityAttributeNames.durationMs]:
                elapsed(startedAt),
              [runtimeObservabilityAttributeNames.httpResponseStatusCode]:
                response.status,
              [runtimeObservabilityAttributeNames.resultStatus]:
                runtimeResultStatuses.succeeded,
            },
            metadata,
          ),
        );
        return parsedPayload.data;
      } catch (error) {
        const apiError = normalizeRequestError(error);
        const event = createApiEvent(
          runtimeObservabilityEventNames.apiRequestFailed,
          {
            ...startAttributes,
            [runtimeObservabilityAttributeNames.apiErrorCode]: apiError.code,
            [runtimeObservabilityAttributeNames.durationMs]: elapsed(startedAt),
            [runtimeObservabilityAttributeNames.httpResponseStatusCode]:
              apiError.statusCode,
            [runtimeObservabilityAttributeNames.resultStatus]:
              runtimeResultStatuses.failed,
          },
          metadata,
          apiError.code,
        );

        if (apiError.failureKind === "api_response") {
          recordWebRuntimeEvent(event);
        } else {
          captureWebRuntimeError(apiError, event);
        }
        throw apiError;
      }
    },
  );
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
  return {
    Accept: "application/json",
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(metadata.noteOperationId === undefined
      ? {}
      : {
          [correlationHeaderNames.noteOperationId]: metadata.noteOperationId,
        }),
    ...(metadata.requestId === undefined
      ? {}
      : { [correlationHeaderNames.requestId]: metadata.requestId }),
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  let payload: unknown;
  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw createInvalidPayloadError(response.status);
  }

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

function createApiEvent(
  name: string,
  attributes: RuntimeObservabilityAttributes,
  metadata: ApiRequestMetadata,
  apiErrorCode?: ApiErrorCode,
): RuntimeObservabilityEvent {
  const route = attributes[runtimeObservabilityAttributeNames.httpRoute];
  const resultStatus =
    attributes[runtimeObservabilityAttributeNames.resultStatus];
  return {
    attributes,
    name,
    surface: "web" as const,
    tags: {
      ...(apiErrorCode === undefined
        ? {}
        : { [runtimeObservabilityAttributeNames.apiErrorCode]: apiErrorCode }),
      ...(typeof route === "string"
        ? { [runtimeObservabilityAttributeNames.httpRoute]: route }
        : {}),
      ...(metadata.noteOperationId === undefined
        ? {}
        : {
            [runtimeObservabilityAttributeNames.noteOperationId]:
              metadata.noteOperationId,
          }),
      ...(metadata.requestId === undefined
        ? {}
        : {
            [runtimeObservabilityAttributeNames.requestId]: metadata.requestId,
          }),
      ...(typeof resultStatus === "string"
        ? {
            [runtimeObservabilityAttributeNames.resultStatus]: resultStatus,
          }
        : {}),
    },
  };
}

function elapsed(startedAt: number): number {
  return Math.max(0, performance.now() - startedAt);
}
