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
  type ClusterIdentity,
  type RuntimeObservabilityAttributes,
  type SaveNoteInput,
} from "@azurite/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  createServerRouteAttributes,
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
  const startAttributes = createServerRouteAttributes(
    request,
    "GET",
    apiRoutes.noteContent,
    {
      [attributeNames.noteId]: noteId,
      [attributeNames.resultStatus]: results.started,
    },
  );
  return runServerNoteRoute(
    request,
    {
      attributes: startAttributes,
      eventName: eventNames.noteReadStarted,
      spanName: runtimeSpanNames.noteRead,
    },
    async () => {
      if (context.options.workspacePath === undefined) {
        return sendReadError(
          request,
          reply,
          workspaceNotConfiguredError(),
          startedAt,
        );
      }
      if (noteId === undefined) {
        return sendReadError(request, reply, invalidNoteIdError(), startedAt);
      }

      try {
        const clusterIdentity = await readOrCreateClusterIdentity(
          context.options.workspacePath,
        );
        const note = await readWorkspaceNote(
          context.options.workspacePath,
          noteId,
        );
        recordServerRouteResult(
          request,
          eventNames.noteReadSucceeded,
          terminalAttributes(startedAt, 200, results.succeeded, {
            ...clusterAttributes(clusterIdentity),
            [attributeNames.contentHash]: note.contentHash,
            [attributeNames.markdownLength]: note.markdown.length,
            [attributeNames.noteId]: note.id,
          }),
        );
        return await reply.send(
          readNoteResponseSchema.parse({ clusterIdentity, note }),
        );
      } catch (error) {
        const safeError = createReadNoteError(error);
        if (safeError.statusCode >= 500) {
          context.server.log.error({ error }, "Failed to read workspace note.");
        }
        return sendReadError(
          request,
          reply,
          safeError,
          startedAt,
          error,
          noteId,
        );
      }
    },
  );
}

function handleNoteSaveRequest(
  context: NotesRouteContext,
  request: SaveNoteRequest,
  reply: FastifyReply,
) {
  const saveInput = parseSaveNoteBody(request.body);
  const startedAt = performance.now();
  const startAttributes = createServerRouteAttributes(
    request,
    "PUT",
    apiRoutes.noteContent,
    {
      [attributeNames.expectedContentHash]: saveInput?.expectedContentHash,
      [attributeNames.noteId]: saveInput?.noteId,
      [attributeNames.resultStatus]: results.started,
    },
  );
  return runServerNoteRoute(
    request,
    {
      attributes: startAttributes,
      eventName: eventNames.noteSaveStarted,
      spanName: runtimeSpanNames.noteSave,
    },
    async () => {
      if (context.options.workspacePath === undefined) {
        return sendSaveError(
          request,
          reply,
          workspaceNotConfiguredError(),
          startedAt,
          saveInput,
        );
      }
      if (saveInput === undefined) {
        return sendSaveError(
          request,
          reply,
          invalidNoteSaveError(),
          startedAt,
          saveInput,
        );
      }

      try {
        const clusterIdentity = await readOrCreateClusterIdentity(
          context.options.workspacePath,
        );
        const note = await writeWorkspaceNote(
          context.options.workspacePath,
          saveInput,
        );
        recordServerRouteResult(
          request,
          eventNames.noteSaveSucceeded,
          terminalAttributes(startedAt, 200, results.succeeded, {
            ...clusterAttributes(clusterIdentity),
            [attributeNames.contentHash]: note.contentHash,
            [attributeNames.noteId]: note.id,
          }),
        );
        return await reply.send(
          saveNoteResponseSchema.parse({ clusterIdentity, note }),
        );
      } catch (error) {
        const safeError = createSaveNoteError(error);
        if (safeError.statusCode >= 500) {
          context.server.log.error({ error }, "Failed to save workspace note.");
        }
        return sendSaveError(
          request,
          reply,
          safeError,
          startedAt,
          saveInput,
          error,
        );
      }
    },
  );
}

function sendReadError(
  request: FastifyRequest,
  reply: FastifyReply,
  safeError: SafeNoteRouteError,
  startedAt: number,
  error?: unknown,
  noteId?: string,
) {
  const code = readSafeApiErrorCode(safeError.body);
  const status =
    code === apiErrorCodes.invalidNoteId
      ? results.invalid
      : code === apiErrorCodes.noteNotFound
        ? results.notFound
        : results.failed;
  const eventName =
    status === results.invalid
      ? eventNames.noteReadInvalid
      : status === results.notFound
        ? eventNames.noteReadNotFound
        : eventNames.noteReadFailed;
  return sendRouteError(
    request,
    reply,
    eventName,
    safeError,
    startedAt,
    error,
    { [attributeNames.noteId]: noteId },
    status,
  );
}

function sendSaveError(
  request: FastifyRequest,
  reply: FastifyReply,
  safeError: SafeNoteRouteError,
  startedAt: number,
  saveInput: SaveNoteInput | undefined,
  error?: unknown,
) {
  const code = readSafeApiErrorCode(safeError.body);
  const [eventName, status] = saveErrorEvent(code);
  return sendRouteError(
    request,
    reply,
    eventName,
    safeError,
    startedAt,
    error,
    {
      [attributeNames.expectedContentHash]: saveInput?.expectedContentHash,
      [attributeNames.noteId]: saveInput?.noteId,
    },
    status,
  );
}

function sendRouteError(
  request: FastifyRequest,
  reply: FastifyReply,
  eventName: string,
  safeError: SafeNoteRouteError,
  startedAt: number,
  error?: unknown,
  extra: RuntimeObservabilityAttributes = {},
  status: string = results.failed,
) {
  const code = readSafeApiErrorCode(safeError.body);
  recordServerRouteResult(
    request,
    eventName,
    terminalAttributes(startedAt, safeError.statusCode, status, {
      ...extra,
      [attributeNames.apiErrorCode]: code,
    }),
    error !== undefined && isUnexpectedNoteRouteError(code) ? error : undefined,
  );
  return reply.status(safeError.statusCode).send(safeError.body);
}

function saveErrorEvent(code: ApiErrorCode): readonly [string, string] {
  if (
    code === apiErrorCodes.invalidNoteId ||
    code === apiErrorCodes.invalidNoteSave
  ) {
    return [eventNames.noteSaveInvalid, results.invalid];
  }
  if (code === apiErrorCodes.noteNotFound) {
    return [eventNames.noteSaveNotFound, results.notFound];
  }
  if (code === apiErrorCodes.noteWriteConflict) {
    return [eventNames.noteSaveConflicted, results.conflicted];
  }
  return [eventNames.noteSaveFailed, results.failed];
}

function terminalAttributes(
  startedAt: number,
  statusCode: number,
  resultStatus: string,
  attributes: RuntimeObservabilityAttributes = {},
): RuntimeObservabilityAttributes {
  return {
    ...attributes,
    [attributeNames.durationMs]: Math.max(0, performance.now() - startedAt),
    [attributeNames.httpResponseStatusCode]: statusCode,
    [attributeNames.resultStatus]: resultStatus,
  };
}

function clusterAttributes(
  identity: ClusterIdentity,
): RuntimeObservabilityAttributes {
  return identity.status === "ready"
    ? {
        [attributeNames.clusterId]: identity.clusterId,
        [attributeNames.clusterIdentityStatus]: identity.status,
      }
    : {
        [attributeNames.clusterIdentityReason]: identity.reason,
        [attributeNames.clusterIdentityStatus]: identity.status,
      };
}

function parseNoteIdQuery(query: NoteContentQuery): string | undefined {
  const parsed = noteIdInputSchema.safeParse(query);
  return parsed.success ? parsed.data.noteId : undefined;
}

function parseSaveNoteBody(body: unknown): SaveNoteInput | undefined {
  const parsed = saveNoteInputSchema.safeParse(body);
  return parsed.success ? parsed.data : undefined;
}
