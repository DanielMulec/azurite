import type { NoteContent } from "@azurite/shared";

import { buildNoteContent } from "./note-metadata.js";
import { resolveNoteIdToMarkdownFile } from "./note-id-resolution.js";
import { resolveWorkspaceRoot } from "./workspace-root.js";

/** Safely reads one markdown note from a user-provided workspace path. */
export async function readWorkspaceNote(
  workspacePath: string,
  noteId: string,
): Promise<NoteContent> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
  const markdownFile = await resolveNoteIdToMarkdownFile(workspaceRoot, noteId);

  return buildNoteContent(markdownFile);
}
