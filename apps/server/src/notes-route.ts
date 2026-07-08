import {
  listWorkspaceNotes,
  NoteResolutionError,
  NoteWriteError,
  readWorkspaceNote,
  writeWorkspaceNote,
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
  saveNoteInputSchema,
  saveNoteResponseSchema,
  type ApiErrorResponse,
  type SaveNoteInput,
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

type SaveNoteRequest = FastifyRequest<{
  readonly Body: unknown;
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
  context.server.put<{ Body: unknown }>(
    apiRoutes.noteContent,
    async (request, reply) => handleSaveNoteRequest(context, request, reply),
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

async function handleSaveNoteRequest(
  context: NotesRouteContext,
  request: SaveNoteRequest,
  reply: FastifyReply,
) {
  const workspacePath = context.options.workspacePath;

  if (workspacePath === undefined) {
    return sendWorkspaceNotConfigured(reply);
  }

  const saveInput = parseSaveNoteBody(request.body);

  if (saveInput === undefined) {
    return sendInvalidNoteSave(reply);
  }

  return sendSavedNote(context, reply, { saveInput, workspacePath });
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

async function sendSavedNote(
  context: NotesRouteContext,
  reply: FastifyReply,
  request: SaveNoteRouteRequest,
) {
  try {
    const note = await writeWorkspaceNote(
      request.workspacePath,
      request.saveInput,
    );
    return await reply.send(saveNoteResponseSchema.parse({ note }));
  } catch (error) {
    const safeError = createSaveNoteError(error);
    logUnexpectedSaveNoteError(context.server, error, safeError);
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

function parseSaveNoteBody(body: unknown): SaveNoteInput | undefined {
  const parsedInput = saveNoteInputSchema.safeParse(body);

  if (!parsedInput.success) {
    return undefined;
  }

  return parsedInput.data;
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

function sendInvalidNoteSave(reply: FastifyReply) {
  return reply
    .status(400)
    .send(
      createApiErrorResponse(
        apiErrorCodes.invalidNoteSave,
        "Save request must include a note ID, markdown, and content hash.",
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

function createSaveNoteError(error: unknown): SafeErrorResult {
  if (error instanceof WorkspaceResolutionError) {
    return {
      body: createApiErrorResponse(
        apiErrorCodes.invalidWorkspace,
        "Configured workspace path is not a readable directory.",
      ),
      statusCode: 500,
    };
  }

  return createSaveNoteFileError(error);
}

function createSaveNoteFileError(error: unknown): SafeErrorResult {
  if (error instanceof NoteResolutionError) {
    return createNoteResolutionError(error);
  }

  if (error instanceof NoteWriteError) {
    return createNoteWriteError(error);
  }

  return {
    body: createApiErrorResponse(
      apiErrorCodes.noteWriteFailed,
      "Unable to save workspace note.",
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

function createNoteWriteError(error: NoteWriteError): SafeErrorResult {
  return {
    body: createApiErrorResponse(
      error.code,
      "The note changed on disk before Azurite could save it.",
    ),
    statusCode: 409,
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

function logUnexpectedSaveNoteError(
  server: FastifyInstance,
  error: unknown,
  safeError: SafeErrorResult,
): void {
  if (safeError.statusCode < 500) {
    return;
  }

  server.log.error({ error }, "Failed to save workspace note.");
}

type SaveNoteRouteRequest = {
  readonly saveInput: SaveNoteInput;
  readonly workspacePath: string;
};
