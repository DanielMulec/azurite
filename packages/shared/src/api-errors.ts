import { z } from "zod";

/** Stable API error code strings that can be reused by server, frontend, and tests. */
export const apiErrorCodes = {
  invalidNoteId: "invalid_note_id",
  invalidWorkspace: "invalid_workspace",
  noteDiscoveryFailed: "note_discovery_failed",
  noteNotFound: "note_not_found",
  noteReadFailed: "note_read_failed",
  workspaceNotConfigured: "workspace_not_configured",
} as const;

/** Runtime schema for stable API error code strings. */
export const apiErrorCodeSchema = z.enum([
  apiErrorCodes.invalidNoteId,
  apiErrorCodes.invalidWorkspace,
  apiErrorCodes.noteDiscoveryFailed,
  apiErrorCodes.noteNotFound,
  apiErrorCodes.noteReadFailed,
  apiErrorCodes.workspaceNotConfigured,
]);

/** TypeScript view of stable API error code strings. */
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** Runtime contract for safe API errors that do not expose private filesystem paths. */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
  }),
});

/** TypeScript view of a safe API error response. */
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/** Creates a safe API error response using one of Azurite's stable error codes. */
export function createApiErrorResponse(
  code: ApiErrorCode,
  message: string,
): ApiErrorResponse {
  return apiErrorResponseSchema.parse({
    error: {
      code,
      message,
    },
  });
}
