import {
  apiErrorResponseSchema,
  apiRoutes,
  createNoteContentRoute,
  createSaveNoteRoute,
  listNotesResponseSchema,
  readNoteResponseSchema,
  saveNoteResponseSchema,
  type ApiErrorCode,
  type ListNotesResponse,
  type ReadNoteResponse,
  type SaveNoteInput,
  type SaveNoteResponse,
} from "@azurite/shared";

type WebApiErrorOptions = {
  readonly code?: ApiErrorCode;
  readonly statusCode?: number;
};

/** Error type used by the web app for safe user-facing API failures. */
export class WebApiError extends Error {
  readonly code: ApiErrorCode | undefined;
  readonly statusCode: number | undefined;

  constructor(message: string, options: WebApiErrorOptions = {}) {
    super(message);
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.name = "WebApiError";
  }
}

/** Lists note summaries from the configured local Azurite workspace. */
export async function listNotes(): Promise<ListNotesResponse> {
  const payload = await requestJson(apiRoutes.notes);
  const parsedPayload = listNotesResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw createInvalidPayloadError();
  }

  return parsedPayload.data;
}

/** Reads one markdown note from the configured local Azurite workspace. */
export async function readNote(noteId: string): Promise<ReadNoteResponse> {
  const payload = await requestJson(createNoteContentRoute(noteId));
  const parsedPayload = readNoteResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw createInvalidPayloadError();
  }

  return parsedPayload.data;
}

/** Saves one existing markdown note through the local Azurite API. */
export async function saveNote(
  input: SaveNoteInput,
): Promise<SaveNoteResponse> {
  const payload = await requestJson(createSaveNoteRoute(), {
    body: JSON.stringify(input),
    method: "PUT",
  });
  const parsedPayload = saveNoteResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw createInvalidPayloadError();
  }

  return parsedPayload.data;
}

async function requestJson(
  routePath: string,
  request: JsonRequest = {},
): Promise<unknown> {
  try {
    const response = await fetch(routePath, createFetchRequest(request));

    return await parseResponse(response);
  } catch (error) {
    throw normalizeRequestError(error);
  }
}

function createFetchRequest(request: JsonRequest): RequestInit {
  if (request.body === undefined) {
    return {
      headers: createRequestHeaders(request),
    };
  }

  return {
    body: request.body,
    headers: createRequestHeaders(request),
    method: request.method,
  };
}

function createRequestHeaders(request: JsonRequest): Record<string, string> {
  if (request.body === undefined) {
    return { Accept: "application/json" };
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  const payload = await readJsonPayload(response);

  if (response.ok) {
    return payload;
  }

  throw createHttpError(response, payload);
}

async function readJsonPayload(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

function createHttpError(response: Response, payload: unknown): WebApiError {
  const parsedError = apiErrorResponseSchema.safeParse(payload);

  if (parsedError.success) {
    return new WebApiError(parsedError.data.error.message, {
      code: parsedError.data.error.code,
      statusCode: response.status,
    });
  }

  return new WebApiError("Azurite returned an unexpected error response.", {
    statusCode: response.status,
  });
}

function createInvalidPayloadError(): WebApiError {
  return new WebApiError("Azurite returned an unexpected response shape.");
}

function normalizeRequestError(error: unknown): WebApiError {
  if (error instanceof WebApiError) {
    return error;
  }

  return new WebApiError("Could not reach the local Azurite server.");
}

type JsonRequest =
  | { readonly body: string; readonly method: "PUT" }
  | { readonly body?: undefined; readonly method?: undefined };
