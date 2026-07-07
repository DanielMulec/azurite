import { apiErrorCodes, noteIdInputSchema } from "@azurite/shared";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { isPathInsideWorkspace } from "./path-boundary.js";
import type { WorkspaceMarkdownFile } from "./note-metadata.js";
import type { ResolvedWorkspaceRoot } from "./workspace-root.js";

/** Stable reason code for failures while resolving a note ID. */
export type NoteResolutionErrorCode =
  typeof apiErrorCodes.invalidNoteId | typeof apiErrorCodes.noteNotFound;

/** Error thrown when a note ID cannot resolve to a safe markdown file. */
export class NoteResolutionError extends Error {
  readonly code: NoteResolutionErrorCode;

  constructor(code: NoteResolutionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "NoteResolutionError";
  }
}

/** Resolves a validated note ID into a private filesystem path inside the workspace. */
export async function resolveNoteIdToMarkdownFile(
  workspaceRoot: ResolvedWorkspaceRoot,
  noteId: string,
): Promise<WorkspaceMarkdownFile> {
  const safeNoteId = parseNoteId(noteId);
  const candidatePath = path.join(
    workspaceRoot.absolutePath,
    ...safeNoteId.split("/"),
  );
  const realFilePath = await resolveExistingNotePath(candidatePath);
  await verifySafeMarkdownFile(workspaceRoot, realFilePath);

  return {
    absolutePath: realFilePath,
    fileName: path.basename(candidatePath),
    relativePath: safeNoteId,
  };
}

function parseNoteId(noteId: string): string {
  const parsedInput = noteIdInputSchema.safeParse({ noteId });

  if (!parsedInput.success) {
    throw new NoteResolutionError(
      apiErrorCodes.invalidNoteId,
      "Note ID must be a relative markdown path.",
    );
  }

  return parsedInput.data.noteId;
}

async function resolveExistingNotePath(candidatePath: string): Promise<string> {
  const realFilePath = await readRealNotePath(candidatePath);

  if (realFilePath === undefined) {
    throw new NoteResolutionError(
      apiErrorCodes.noteNotFound,
      "Requested note does not exist.",
    );
  }

  return realFilePath;
}

async function verifySafeMarkdownFile(
  workspaceRoot: ResolvedWorkspaceRoot,
  realFilePath: string,
): Promise<void> {
  verifyInsideWorkspace(workspaceRoot, realFilePath);
  await verifyRegularFile(realFilePath);
  verifyMarkdownPath(realFilePath);
}

function verifyInsideWorkspace(
  workspaceRoot: ResolvedWorkspaceRoot,
  realFilePath: string,
): void {
  if (!isPathInsideWorkspace(workspaceRoot, realFilePath)) {
    throw new NoteResolutionError(
      apiErrorCodes.invalidNoteId,
      "Requested note must stay inside the workspace.",
    );
  }
}

async function verifyRegularFile(realFilePath: string): Promise<void> {
  const fileStats = await readFileStats(realFilePath);

  if (fileStats === undefined) {
    throw new NoteResolutionError(
      apiErrorCodes.noteNotFound,
      "Requested note does not exist.",
    );
  }

  if (!fileStats.isFile()) {
    throw new NoteResolutionError(
      apiErrorCodes.noteNotFound,
      "Requested note is not a markdown file.",
    );
  }
}

function verifyMarkdownPath(realFilePath: string): void {
  if (path.extname(realFilePath) !== ".md") {
    throw new NoteResolutionError(
      apiErrorCodes.invalidNoteId,
      "Requested note must resolve to a markdown file.",
    );
  }
}

async function readRealNotePath(
  candidatePath: string,
): Promise<string | undefined> {
  try {
    return await realpath(candidatePath);
  } catch {
    return undefined;
  }
}

async function readFileStats(realFilePath: string) {
  try {
    return await stat(realFilePath);
  } catch {
    return undefined;
  }
}
