import { z } from "zod";

/** API input for the user-provided folder Azurite should treat as a workspace. */
export const workspacePathInputSchema = z.object({
  workspacePath: z.string().min(1),
});

/** TypeScript view of a workspace path API input payload. */
export type WorkspacePathInput = z.infer<typeof workspacePathInputSchema>;

/** Runtime contract for a lightweight markdown note list item. */
export const noteSummarySchema = z.object({
  id: z.string().min(1),
  relativePath: z.string().min(1),
  fileName: z.string().min(1),
  title: z.string().min(1),
  lastModifiedAt: z.iso.datetime(),
  sizeBytes: z.number().int().nonnegative(),
});

/** TypeScript view of a lightweight markdown note list item. */
export type NoteSummary = z.infer<typeof noteSummarySchema>;

/** Runtime contract for the successful note-list API response. */
export const listNotesResponseSchema = z.object({
  notes: z.array(noteSummarySchema),
});

/** TypeScript view of the successful note-list API response. */
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;

/** Runtime contract for safe API errors that do not expose private filesystem paths. */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

/** TypeScript view of a safe API error response. */
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
