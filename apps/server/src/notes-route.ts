import {
  readOrCreateClusterIdentity,
  readWorkspaceNote,
  writeWorkspaceNote,
} from "@azurite/core";
import {
  apiErrorCodes,
  apiQueryParameters,
  apiRoutes,
  noteIdInputSchema,
  readNoteResponseSchema,
  runtimeObservabilityAttributeNames as attributeNames,
  runtimeObservabilityEventNames as eventNames,
  runtimeResultStatuses as results,
  runtimeSpanNames,
  saveNoteInputSchema,
  saveNoteResponseSchema,
  type ApiErrorCode,
  type RuntimeObservabilityAttributes,
  type SaveNoteInput,
} from "@azurite/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  createClusterAttributes,
  createServerRouteAttributes,
  createServerTerminalAttributes,
  readSafeApiErrorCode,
  recordServerRouteResult,
  runServerNoteRoute,
} from "./note-route-observability.js";
import { registerNotesListRoute } from "./notes-list-route.js";
import {
  createReadNoteError,
  createSaveNoteError,
  invalidNoteIdError,
  invalidNoteSaveError,
  isUnexpectedNoteRouteError,
  type SafeNoteRouteError,
  workspaceNotConfiguredError,
} from "./notes-route-errors.js";
import type { ServerOptions } from "./server-options.js";

type NoteContentQuery = Partial<
  Record<typeof apiQueryParameters.noteId, unknown>
>;
type NoteContentRequest = FastifyRequest<{
  readonly Querystring: NoteContentQuery;
}>;
type SaveNoteRequest = FastifyRequest<{ readonly Body: unknown }>;
type NotesRouteContext = {
  readonly options: ServerOptions;
  readonly server: FastifyInstance;
};
type ReadExecutionInput = {
  readonly context: NotesRouteContext;
  readonly noteId: string | undefined;
  readonly reply: FastifyReply;
  readonly request: NoteContentRequest;
  readonly startedAt: number;
};
type SaveExecutionInput = {
  readonly context: NotesRouteContext;
  readonly reply: FastifyReply;
  readonly request: SaveNoteRequest;
  readonly saveInput: SaveNoteInput | undefined;
  readonly startedAt: number;
};
type RouteErrorInput = {
  readonly error?: unknown;
  readonly eventName: string;
  readonly extra?: RuntimeObservabilityAttributes;
  readonly reply: FastifyReply;
  readonly request: FastifyRequest;
  readonly safeError: SafeNoteRouteError;
  readonly startedAt: number;
  readonly status?: string;
};
type ServerLogErrorInput = {
  readonly context: NotesRouteContext;
  readonly error: unknown;
  readonly operation: "read" | "save";
  readonly safeError: SafeNoteRouteError;
};

/** Registers note API routes while keeping filesystem work inside core. */
export function registerNotesRoute(
  server: FastifyInstance,
  options: ServerOptions,
): void {
  const context = { options, server };
  registerNotesListRoute(server, options);
  server.get<{ Querystring: NoteContentQuery }>(
    apiRoutes.noteContent,
    async (request, reply) => handleNoteReadRequest(context, request, reply),
  );
  server.put<{ Body: unknown }>(apiRoutes.noteContent, async (request, reply) =>
    handleNoteSaveRequest(context, request, reply),
  );
}

function handleNoteReadRequest(
  context: NotesRouteContext,
  request: NoteContentRequest,
  reply: FastifyReply,
) {
  const noteId = parseNoteIdQuery(request.query);
  const startedAt = performance.now();
  const startAttributes = createServerRouteAttributes({
    attributes: {
      [attributeNames.noteId]: noteId,
      [attributeNames.resultStatus]: results.started,
    },
    method: "GET",
    request,
    route: apiRoutes.noteContent,
  });
  return runServerNoteRoute(
    request,
    {
      attributes: startAttributes,
      eventName: eventNames.noteReadStarted,
      spanName: runtimeSpanNames.noteRead,
    },
    () => executeNoteRead({ context, noteId, reply, request, startedAt }),
  );
}

function handleNoteSaveRequest(
  context: NotesRouteContext,
  request: SaveNoteRequest,
  reply: FastifyReply,
) {
  const saveInput = parseSaveNoteBody(request.body);
  const startedAt = performance.now();
  const startAttributes = createServerRouteAttributes({
    attributes: {
      [attributeNames.expectedContentHash]: saveInput?.expectedContentHash,
      [attributeNames.noteId]: saveInput?.noteId,
      [attributeNames.resultStatus]: results.started,
    },
    method: "PUT",
    request,
    route: apiRoutes.noteContent,
  });
  return runServerNoteRoute(
    request,
    {
      attributes: startAttributes,
      eventName: eventNames.noteSaveStarted,
      spanName: runtimeSpanNames.noteSave,
    },
    () => executeNoteSave({ context, reply, request, saveInput, startedAt }),
  );
}

async function executeNoteRead(input: ReadExecutionInput) {
  const workspacePath = input.context.options.workspacePath;
  if (workspacePath === undefined) {
    return sendReadError(input, workspaceNotConfiguredError());
  }
  if (input.noteId === undefined) {
    return sendReadError(input, invalidNoteIdError());
  }
  return readValidNote(input, workspacePath, input.noteId);
}

async function readValidNote(
  input: ReadExecutionInput,
  workspacePath: string,
  noteId: string,
) {
  try {
    const clusterIdentity = await readOrCreateClusterIdentity(workspacePath);
    const note = await readWorkspaceNote(workspacePath, noteId);
    recordServerRouteResult({
      attributes: createServerTerminalAttributes({
        attributes: {
          ...createClusterAttributes(clusterIdentity),
          [attributeNames.contentHash]: note.contentHash,
          [attributeNames.markdownLength]: note.markdown.length,
          [attributeNames.noteId]: note.id,
        },
        resultStatus: results.succeeded,
        startedAt: input.startedAt,
        statusCode: 200,
      }),
      eventName: eventNames.noteReadSucceeded,
      request: input.request,
    });
    return await input.reply.send(
      readNoteResponseSchema.parse({ clusterIdentity, note }),
    );
  } catch (error) {
    const safeError = createReadNoteError(error);
    logServerRouteError({
      context: input.context,
      error,
      operation: "read",
      safeError,
    });
    return sendReadError(input, safeError, error);
  }
}

async function executeNoteSave(input: SaveExecutionInput) {
  const workspacePath = input.context.options.workspacePath;
  if (workspacePath === undefined) {
    return sendSaveError(input, workspaceNotConfiguredError());
  }
  if (input.saveInput === undefined) {
    return sendSaveError(input, invalidNoteSaveError());
  }
  return writeValidNote(input, workspacePath, input.saveInput);
}

async function writeValidNote(
  input: SaveExecutionInput,
  workspacePath: string,
  saveInput: SaveNoteInput,
) {
  try {
    const clusterIdentity = await readOrCreateClusterIdentity(workspacePath);
    const note = await writeWorkspaceNote(workspacePath, saveInput);
    recordServerRouteResult({
      attributes: createServerTerminalAttributes({
        attributes: {
          ...createClusterAttributes(clusterIdentity),
          [attributeNames.contentHash]: note.contentHash,
          [attributeNames.noteId]: note.id,
        },
        resultStatus: results.succeeded,
        startedAt: input.startedAt,
        statusCode: 200,
      }),
      eventName: eventNames.noteSaveSucceeded,
      request: input.request,
    });
    return await input.reply.send(
      saveNoteResponseSchema.parse({ clusterIdentity, note }),
    );
  } catch (error) {
    const safeError = createSaveNoteError(error);
    logServerRouteError({
      context: input.context,
      error,
      operation: "save",
      safeError,
    });
    return sendSaveError(input, safeError, error);
  }
}

function logServerRouteError(input: ServerLogErrorInput): void {
  if (input.safeError.statusCode < 500) {
    return;
  }
  input.context.server.log.error(
    { error: input.error },
    `Failed to ${input.operation} workspace note.`,
  );
}

function sendReadError(
  input: ReadExecutionInput,
  safeError: SafeNoteRouteError,
  error?: unknown,
) {
  const code = readSafeApiErrorCode(safeError.body);
  const [eventName, status] = readErrorEvent(code);
  return sendRouteError({
    error,
    eventName,
    extra: { [attributeNames.noteId]: input.noteId },
    reply: input.reply,
    request: input.request,
    safeError,
    startedAt: input.startedAt,
    status,
  });
}

function sendSaveError(
  input: SaveExecutionInput,
  safeError: SafeNoteRouteError,
  error?: unknown,
) {
  const code = readSafeApiErrorCode(safeError.body);
  const [eventName, status] = saveErrorEvent(code);
  return sendRouteError({
    error,
    eventName,
    extra: {
      [attributeNames.expectedContentHash]:
        input.saveInput?.expectedContentHash,
      [attributeNames.noteId]: input.saveInput?.noteId,
    },
    reply: input.reply,
    request: input.request,
    safeError,
    startedAt: input.startedAt,
    status,
  });
}

function sendRouteError(input: RouteErrorInput) {
  const code = readSafeApiErrorCode(input.safeError.body);
  recordServerRouteResult({
    attributes: createServerTerminalAttributes({
      attributes: {
        ...input.extra,
        [attributeNames.apiErrorCode]: code,
      },
      resultStatus: input.status ?? results.failed,
      startedAt: input.startedAt,
      statusCode: input.safeError.statusCode,
    }),
    error: ownedUnexpectedError(code, input.error),
    eventName: input.eventName,
    request: input.request,
  });
  return input.reply
    .status(input.safeError.statusCode)
    .send(input.safeError.body);
}

function saveErrorEvent(code: ApiErrorCode): readonly [string, string] {
  return saveErrorEvents[code] ?? defaultSaveErrorEvent;
}

function readErrorEvent(code: ApiErrorCode): readonly [string, string] {
  return readErrorEvents[code] ?? defaultReadErrorEvent;
}

const defaultReadErrorEvent = [
  eventNames.noteReadFailed,
  results.failed,
] as const;
const readErrorEvents: Partial<
  Record<ApiErrorCode, readonly [string, string]>
> = {
  [apiErrorCodes.invalidNoteId]: [eventNames.noteReadInvalid, results.invalid],
  [apiErrorCodes.noteNotFound]: [eventNames.noteReadNotFound, results.notFound],
};
const defaultSaveErrorEvent = [
  eventNames.noteSaveFailed,
  results.failed,
] as const;
const saveErrorEvents: Partial<
  Record<ApiErrorCode, readonly [string, string]>
> = {
  [apiErrorCodes.invalidNoteId]: [eventNames.noteSaveInvalid, results.invalid],
  [apiErrorCodes.invalidNoteSave]: [
    eventNames.noteSaveInvalid,
    results.invalid,
  ],
  [apiErrorCodes.noteNotFound]: [eventNames.noteSaveNotFound, results.notFound],
  [apiErrorCodes.noteWriteConflict]: [
    eventNames.noteSaveConflicted,
    results.conflicted,
  ],
};

function ownedUnexpectedError(code: ApiErrorCode, error: unknown): unknown {
  if (error === undefined) {
    return undefined;
  }
  return isUnexpectedNoteRouteError(code) ? error : undefined;
}

function parseNoteIdQuery(query: NoteContentQuery): string | undefined {
  const parsed = noteIdInputSchema.safeParse(query);
  return parsed.success ? parsed.data.noteId : undefined;
}

function parseSaveNoteBody(body: unknown): SaveNoteInput | undefined {
  const parsed = saveNoteInputSchema.safeParse(body);
  return parsed.success ? parsed.data : undefined;
}
