import { listWorkspaceNotes, readOrCreateClusterIdentity } from "@azurite/core";
import {
  apiRoutes,
  listNotesResponseSchema,
  runtimeObservabilityAttributeNames as attributeNames,
  runtimeObservabilityEventNames as eventNames,
  runtimeResultStatuses as results,
  runtimeSpanNames,
  type ClusterIdentity,
  type RuntimeObservabilityAttributes,
} from "@azurite/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  createServerRouteAttributes,
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

/** Registers the note-list route and its correlation evidence. */
export function registerNotesListRoute(
  server: FastifyInstance,
  options: ServerOptions,
): void {
  server.get(apiRoutes.notes, async (request, reply) => {
    const startedAt = performance.now();
    const startAttributes = createServerRouteAttributes(
      request,
      "GET",
      apiRoutes.notes,
      { [attributeNames.resultStatus]: results.started },
    );
    return runServerNoteRoute(
      request,
      {
        attributes: startAttributes,
        eventName: eventNames.notesListStarted,
        spanName: runtimeSpanNames.notesList,
      },
      async () => {
        if (options.workspacePath === undefined) {
          return sendListError(
            request,
            reply,
            workspaceNotConfiguredError(),
            undefined,
            startedAt,
          );
        }
        try {
          const clusterIdentity = await readOrCreateClusterIdentity(
            options.workspacePath,
          );
          const notes = await listWorkspaceNotes(options.workspacePath);
          recordServerRouteResult(
            request,
            eventNames.notesListSucceeded,
            terminalAttributes(startedAt, 200, results.succeeded, {
              ...clusterAttributes(clusterIdentity),
              [attributeNames.noteCount]: notes.length,
            }),
          );
          return await reply.send(
            listNotesResponseSchema.parse({ clusterIdentity, notes }),
          );
        } catch (error) {
          const safeError = createDiscoveryError(error);
          server.log.error({ error }, "Failed to list workspace notes.");
          return sendListError(request, reply, safeError, error, startedAt);
        }
      },
    );
  });
}

function sendListError(
  request: FastifyRequest,
  reply: FastifyReply,
  safeError: ReturnType<typeof workspaceNotConfiguredError>,
  error?: unknown,
  startedAt = performance.now(),
) {
  const code = readSafeApiErrorCode(safeError.body);
  recordServerRouteResult(
    request,
    eventNames.notesListFailed,
    terminalAttributes(startedAt, safeError.statusCode, results.failed, {
      [attributeNames.apiErrorCode]: code,
    }),
    error !== undefined && isUnexpectedNoteRouteError(code) ? error : undefined,
  );
  return reply.status(safeError.statusCode).send(safeError.body);
}

function terminalAttributes(
  startedAt: number,
  statusCode: number,
  resultStatus: string,
  attributes: RuntimeObservabilityAttributes,
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
