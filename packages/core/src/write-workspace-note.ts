import { apiErrorCodes, type SaveNoteInput } from "@azurite/shared";
import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createContentHash } from "./content-hash.js";
import { buildNoteContent } from "./note-metadata.js";
import { resolveNoteIdToMarkdownFile } from "./note-id-resolution.js";
import { resolveWorkspaceRoot } from "./workspace-root.js";

/** Stable reason code for failures while writing a markdown note. */
export type NoteWriteErrorCode = typeof apiErrorCodes.noteWriteConflict;

/** Error thrown when a safe note write cannot proceed. */
export class NoteWriteError extends Error {
  readonly code: NoteWriteErrorCode;

  constructor(code: NoteWriteErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "NoteWriteError";
  }
}

/** Safely saves one existing markdown note inside a user-provided workspace. */
export async function writeWorkspaceNote(
  workspacePath: string,
  input: SaveNoteInput,
) {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
  const markdownFile = await resolveNoteIdToMarkdownFile(
    workspaceRoot,
    input.noteId,
  );
  const currentMarkdown = await readFile(markdownFile.absolutePath, "utf8");
  verifyExpectedHash(currentMarkdown, input.expectedContentHash);
  const markdownToWrite = preserveDominantLineEndings(
    input.markdown,
    currentMarkdown,
  );

  await writeMarkdownAtomically(markdownFile.absolutePath, markdownToWrite);

  return buildNoteContent(markdownFile);
}

function verifyExpectedHash(
  currentMarkdown: string,
  expectedContentHash: string,
): void {
  if (createContentHash(currentMarkdown) === expectedContentHash) {
    return;
  }

  throw new NoteWriteError(
    apiErrorCodes.noteWriteConflict,
    "The note changed on disk before Azurite could save it.",
  );
}

function preserveDominantLineEndings(
  nextMarkdown: string,
  currentMarkdown: string,
): string {
  return normalizeLineEndings(
    nextMarkdown,
    getDominantLineEnding(currentMarkdown),
  );
}

function getDominantLineEnding(markdown: string): "\n" | "\r\n" {
  if (countCrLfLineEndings(markdown) > countLfOnlyLineEndings(markdown)) {
    return "\r\n";
  }

  return "\n";
}

function countCrLfLineEndings(markdown: string): number {
  const matches = markdown.match(/\r\n/gu);
  return matches === null ? 0 : matches.length;
}

function countLfOnlyLineEndings(markdown: string): number {
  return countLineFeeds(markdown) - countCrLfLineEndings(markdown);
}

function countLineFeeds(markdown: string): number {
  const matches = markdown.match(/\n/gu);
  return matches === null ? 0 : matches.length;
}

function normalizeLineEndings(markdown: string, lineEnding: "\n" | "\r\n") {
  return markdown.replace(/\r\n|\r|\n/gu, lineEnding);
}

async function writeMarkdownAtomically(
  targetPath: string,
  markdown: string,
): Promise<void> {
  const temporaryPath = createTemporaryPath(targetPath);

  try {
    await writeFileWithSync(temporaryPath, markdown);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(ignoreCleanupError);
    throw error;
  }
}

function createTemporaryPath(targetPath: string): string {
  return path.join(
    path.dirname(targetPath),
    `.azurite-${path.basename(targetPath)}-${String(process.pid)}-${randomUUID()}.tmp`,
  );
}

async function writeFileWithSync(filePath: string, markdown: string) {
  const fileHandle = await open(filePath, "wx");

  try {
    await fileHandle.writeFile(markdown, "utf8");
    await fileHandle.sync();
  } finally {
    await fileHandle.close();
  }
}

function ignoreCleanupError(): void {}
