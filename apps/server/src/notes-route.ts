import { listWorkspaceNotes, WorkspaceResolutionError } from "@azurite/core";
import {
  apiErrorResponseSchema,
  listNotesResponseSchema,
  type ApiErrorResponse,
} from "@azurite/shared";
import type { FastifyInstance } from "fastify";

import type { ServerOptions } from "./server-options.js";

type SafeErrorResult = {
  readonly body: ApiErrorResponse;
  readonly statusCode: number;
};

/** Registers the note-list API route while keeping filesystem work inside core. */
export function registerNotesRoute(
  server: FastifyInstance,
  options: ServerOptions,
): void {
  server.get("/api/notes", async (_request, reply) => {
    if (options.workspacePath === undefined) {
      return reply
        .status(500)
        .send(
          createApiErrorResponse(
            "workspace_not_configured",
            "Workspace path is not configured.",
          ),
        );
    }

    try {
      const notes = await listWorkspaceNotes(options.workspacePath);
      return await reply.send(listNotesResponseSchema.parse({ notes }));
    } catch (error) {
      const safeError = createDiscoveryError(error);
      server.log.error({ error }, "Failed to list workspace notes.");
      return reply.status(safeError.statusCode).send(safeError.body);
    }
  });
}

function createDiscoveryError(error: unknown): SafeErrorResult {
  if (error instanceof WorkspaceResolutionError) {
    return {
      body: createApiErrorResponse(
        "invalid_workspace",
        "Configured workspace path is not a readable directory.",
      ),
      statusCode: 500,
    };
  }

  return {
    body: createApiErrorResponse(
      "note_discovery_failed",
      "Unable to list workspace notes.",
    ),
    statusCode: 500,
  };
}

function createApiErrorResponse(
  code: string,
  message: string,
): ApiErrorResponse {
  return apiErrorResponseSchema.parse({
    error: {
      code,
      message,
    },
  });
}
