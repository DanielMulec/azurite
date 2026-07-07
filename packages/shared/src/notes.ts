import { z } from "zod";

/** Directory names that Azurite treats as workspace metadata instead of notes. */
export const ignoredWorkspaceDirectoryNames = [
  ".azurite",
  ".git",
  ".obsidian",
  "node_modules",
] as const;

const ignoredWorkspaceDirectoryNameSet = new Set<string>(
  ignoredWorkspaceDirectoryNames,
);
const noteIdValidationRules = [
  hasMarkdownExtension,
  isRelativePathText,
  hasNoTraversalSegments,
  hasNoCurrentDirectorySegments,
  hasNoEmptySegments,
  hasNoIgnoredDirectorySegments,
];

/** API input for the user-provided folder Azurite should treat as a workspace. */
export const workspacePathInputSchema = z.object({
  workspacePath: z.string().min(1),
});

/** TypeScript view of a workspace path API input payload. */
export type WorkspacePathInput = z.infer<typeof workspacePathInputSchema>;

/** API input for reading one markdown note by workspace-relative ID. */
export const noteIdInputSchema = z.object({
  noteId: z.string().min(1).refine(isValidNoteId),
});

/** TypeScript view of a note-content API input payload. */
export type NoteIdInput = z.infer<typeof noteIdInputSchema>;

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

/** Runtime contract for a markdown note body plus its safe list metadata. */
export const noteContentSchema = noteSummarySchema.extend({
  markdown: z.string(),
});

/** TypeScript view of a markdown note body plus its safe list metadata. */
export type NoteContent = z.infer<typeof noteContentSchema>;

/** Runtime contract for the successful note-list API response. */
export const listNotesResponseSchema = z.object({
  notes: z.array(noteSummarySchema),
});

/** TypeScript view of the successful note-list API response. */
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;

/** Runtime contract for the successful note-content API response. */
export const readNoteResponseSchema = z.object({
  note: noteContentSchema,
});

/** TypeScript view of the successful note-content API response. */
export type ReadNoteResponse = z.infer<typeof readNoteResponseSchema>;

/** Checks whether a path segment is reserved for workspace metadata. */
export function isIgnoredWorkspaceDirectoryName(
  directoryName: string,
): boolean {
  return ignoredWorkspaceDirectoryNameSet.has(directoryName);
}

function isValidNoteId(noteId: string): boolean {
  return noteIdValidationRules.every((rule) => rule(noteId));
}

function hasMarkdownExtension(noteId: string): boolean {
  return noteId.endsWith(".md");
}

function isRelativePathText(noteId: string): boolean {
  return !noteId.startsWith("/");
}

function hasNoTraversalSegments(noteId: string): boolean {
  return getPathSegments(noteId).every(isNotTraversalSegment);
}

function hasNoCurrentDirectorySegments(noteId: string): boolean {
  return getPathSegments(noteId).every(isNotCurrentDirectorySegment);
}

function hasNoEmptySegments(noteId: string): boolean {
  return getPathSegments(noteId).every(hasText);
}

function hasNoIgnoredDirectorySegments(noteId: string): boolean {
  return getPathSegments(noteId).every(isNotIgnoredDirectorySegment);
}

function getPathSegments(noteId: string): string[] {
  return noteId.split("/");
}

function isNotTraversalSegment(segment: string): boolean {
  return segment !== "..";
}

function isNotCurrentDirectorySegment(segment: string): boolean {
  return segment !== ".";
}

function isNotIgnoredDirectorySegment(segment: string): boolean {
  return !isIgnoredWorkspaceDirectoryName(segment);
}

function hasText(segment: string): boolean {
  return segment.length > 0;
}
