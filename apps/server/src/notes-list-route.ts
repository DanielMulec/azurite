import { listWorkspaceNotes, readOrCreateClusterIdentity } from "@azurite/core";
import {
  apiRoutes,
  listNotesResponseSchema,
  runtimeObservabilityAttributeNames as attributeNames,
  runtimeObservabilityEventNames as eventNames,
  runtimeResultStatuses as results,
  runtimeSpanNames,
} from "@azurite/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  createServerRouteAttributes,
  createServerTerminalAttributes,
  createClusterAttributes,
  readSafeApiErrorCode,
  recordServerRouteResult,
  runServerNoteRoute,
} from "./note-route-observability.js";
import {
  createDiscoveryError,
  isUnexpectedNoteRouteError,
  workspaceNotConfiguredError,
} from "./notes-route-errors.js";
import type { ServerOptions } from "./server-options.js";

type ListErrorInput = {
  readonly error?: unknown;
  readonly reply: FastifyReply;
  readonly request: FastifyRequest;
  readonly safeError: ReturnType<typeof workspaceNotConfiguredError>;
  readonly startedAt: number;
};

/** Registers the note-list route and its correlation evidence. */
export function registerNotesListRoute(
  server: FastifyInstance,
  options: ServerOptions,
): void {
  server.get(apiRoutes.notes, async (request, reply) => {
    const startedAt = performance.now();
    const startAttributes = createServerRouteAttributes({
      attributes: { [attributeNames.resultStatus]: results.started },
      method: "GET",
      request,
      route: apiRoutes.notes,
    });
    return runServerNoteRoute(
      request,
      {
        attributes: startAttributes,
        eventName: eventNames.notesListStarted,
        spanName: runtimeSpanNames.notesList,
      },
      async () => {
        if (options.workspacePath === undefined) {
          return sendListError({
            reply,
            request,
            safeError: workspaceNotConfiguredError(),
            startedAt,
          });
        }
        try {
          const clusterIdentity = await readOrCreateClusterIdentity(
            options.workspacePath,
          );
          const notes = await listWorkspaceNotes(options.workspacePath);
          recordServerRouteResult({
            attributes: createServerTerminalAttributes({
              attributes: {
                ...createClusterAttributes(clusterIdentity),
                [attributeNames.noteCount]: notes.length,
              },
              resultStatus: results.succeeded,
              startedAt,
              statusCode: 200,
            }),
            eventName: eventNames.notesListSucceeded,
            request,
          });
          return await reply.send(
            listNotesResponseSchema.parse({ clusterIdentity, notes }),
          );
        } catch (error) {
          const safeError = createDiscoveryError(error);
          server.log.error({ error }, "Failed to list workspace notes.");
          return sendListError({ error, reply, request, safeError, startedAt });
        }
      },
    );
  });
}

function sendListError(input: ListErrorInput) {
  const code = readSafeApiErrorCode(input.safeError.body);
  recordServerRouteResult({
    attributes: createServerTerminalAttributes({
      attributes: { [attributeNames.apiErrorCode]: code },
      resultStatus: results.failed,
      startedAt: input.startedAt,
      statusCode: input.safeError.statusCode,
    }),
    error: ownedUnexpectedError(code, input.error),
    eventName: eventNames.notesListFailed,
    request: input.request,
  });
  return input.reply
    .status(input.safeError.statusCode)
    .send(input.safeError.body);
}

function ownedUnexpectedError(
  code: ReturnType<typeof readSafeApiErrorCode>,
  error: unknown,
): unknown {
  if (error === undefined) {
    return undefined;
  }
  return isUnexpectedNoteRouteError(code) ? error : undefined;
}
