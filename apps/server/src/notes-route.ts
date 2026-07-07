import {
  listWorkspaceNotes,
  NoteResolutionError,
  readWorkspaceNote,
  WorkspaceResolutionError,
} from "@azurite/core";
import {
  apiErrorCodes,
  apiQueryParameters,
  apiRoutes,
  createApiErrorResponse,
  listNotesResponseSchema,
  noteIdInputSchema,
  readNoteResponseSchema,
  type ApiErrorResponse,
} from "@azurite/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { ServerOptions } from "./server-options.js";

type SafeErrorResult = {
  readonly body: ApiErrorResponse;
  readonly statusCode: number;
};

type NoteContentQuery = Partial<
  Record<typeof apiQueryParameters.noteId, unknown>
>;

type NoteContentRequest = FastifyRequest<{
  readonly Querystring: NoteContentQuery;
}>;

type NotesRouteContext = {
  readonly options: ServerOptions;
  readonly server: FastifyInstance;
};

type ReadNoteRequest = {
  readonly noteId: string;
  readonly workspacePath: string;
};

/** Registers note API routes while keeping filesystem work inside core. */
export function registerNotesRoute(
  server: FastifyInstance,
  options: ServerOptions,
): void {
  const context = { options, server };

  registerNoteListRoute(context);
  registerNoteContentRoute(context);
}

function registerNoteListRoute(context: NotesRouteContext): void {
  context.server.get(apiRoutes.notes, async (_request, reply) =>
    handleNoteListRequest(context, reply),
  );
}

function registerNoteContentRoute(context: NotesRouteContext): void {
  context.server.get<{ Querystring: NoteContentQuery }>(
    apiRoutes.noteContent,
    async (request, reply) => handleNoteContentRequest(context, request, reply),
  );
}

async function handleNoteListRequest(
  context: NotesRouteContext,
  reply: FastifyReply,
) {
  if (context.options.workspacePath === undefined) {
    return sendWorkspaceNotConfigured(reply);
  }

  try {
    const notes = await listWorkspaceNotes(context.options.workspacePath);
    return await reply.send(listNotesResponseSchema.parse({ notes }));
  } catch (error) {
    const safeError = createDiscoveryError(error);
    context.server.log.error({ error }, "Failed to list workspace notes.");
    return reply.status(safeError.statusCode).send(safeError.body);
  }
}

async function handleNoteContentRequest(
  context: NotesRouteContext,
  request: NoteContentRequest,
  reply: FastifyReply,
) {
  const workspacePath = context.options.workspacePath;

  if (workspacePath === undefined) {
    return sendWorkspaceNotConfigured(reply);
  }

  const noteId = parseNoteIdQuery(request.query);

  if (noteId === undefined) {
    return sendInvalidNoteId(reply);
  }

  return sendNoteContent(context, reply, { noteId, workspacePath });
}

async function sendNoteContent(
  context: NotesRouteContext,
  reply: FastifyReply,
  request: ReadNoteRequest,
) {
  try {
    const note = await readWorkspaceNote(request.workspacePath, request.noteId);
    return await reply.send(readNoteResponseSchema.parse({ note }));
  } catch (error) {
    const safeError = createReadNoteError(error);
    logUnexpectedReadNoteError(context.server, error, safeError);
    return reply.status(safeError.statusCode).send(safeError.body);
  }
}

function parseNoteIdQuery(query: NoteContentQuery): string | undefined {
  const parsedInput = noteIdInputSchema.safeParse(query);

  if (!parsedInput.success) {
    return undefined;
  }

  return parsedInput.data.noteId;
}

function sendWorkspaceNotConfigured(reply: FastifyReply) {
  return reply
    .status(500)
    .send(
      createApiErrorResponse(
        apiErrorCodes.workspaceNotConfigured,
        "Workspace path is not configured.",
      ),
    );
}

function sendInvalidNoteId(reply: FastifyReply) {
  return reply
    .status(400)
    .send(
      createApiErrorResponse(
        apiErrorCodes.invalidNoteId,
        "Note ID must be a relative markdown path.",
      ),
    );
}

function createDiscoveryError(error: unknown): SafeErrorResult {
  if (error instanceof WorkspaceResolutionError) {
    return {
      body: createApiErrorResponse(
        apiErrorCodes.invalidWorkspace,
        "Configured workspace path is not a readable directory.",
      ),
      statusCode: 500,
    };
  }

  return {
    body: createApiErrorResponse(
      apiErrorCodes.noteDiscoveryFailed,
      "Unable to list workspace notes.",
    ),
    statusCode: 500,
  };
}

function createReadNoteError(error: unknown): SafeErrorResult {
  if (error instanceof WorkspaceResolutionError) {
    return {
      body: createApiErrorResponse(
        apiErrorCodes.invalidWorkspace,
        "Configured workspace path is not a readable directory.",
      ),
      statusCode: 500,
    };
  }

  if (error instanceof NoteResolutionError) {
    return createNoteResolutionError(error);
  }

  return {
    body: createApiErrorResponse(
      apiErrorCodes.noteReadFailed,
      "Unable to read workspace note.",
    ),
    statusCode: 500,
  };
}

function createNoteResolutionError(
  error: NoteResolutionError,
): SafeErrorResult {
  if (error.code === apiErrorCodes.invalidNoteId) {
    return {
      body: createApiErrorResponse(
        apiErrorCodes.invalidNoteId,
        "Note ID must be a relative markdown path.",
      ),
      statusCode: 400,
    };
  }

  return {
    body: createApiErrorResponse(
      apiErrorCodes.noteNotFound,
      "Requested note was not found.",
    ),
    statusCode: 404,
  };
}

function logUnexpectedReadNoteError(
  server: FastifyInstance,
  error: unknown,
  safeError: SafeErrorResult,
): void {
  if (safeError.statusCode < 500) {
    return;
  }

  server.log.error({ error }, "Failed to read workspace note.");
}
