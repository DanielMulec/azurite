import type { NoteContentWithHash, NoteSummary } from "@azurite/shared";
import { readFile, stat } from "node:fs/promises";

import { createContentHash } from "./content-hash.js";
import { extractNoteTitle } from "./title-extraction.js";

/** Markdown file details needed to build safe public note metadata. */
export type WorkspaceMarkdownFile = {
  readonly absolutePath: string;
  readonly fileName: string;
  readonly relativePath: string;
};

type MarkdownFileData = {
  readonly lastModifiedAt: string;
  readonly markdown: string;
  readonly sizeBytes: number;
};

/** Builds a safe note-list item from a markdown file inside the workspace. */
export async function buildNoteSummary(
  markdownFile: WorkspaceMarkdownFile,
): Promise<NoteSummary> {
  const fileData = await readMarkdownFileData(markdownFile);

  return buildNoteSummaryFromData(markdownFile, fileData);
}

/** Builds a safe note body response from a markdown file inside the workspace. */
export async function buildNoteContent(
  markdownFile: WorkspaceMarkdownFile,
): Promise<NoteContentWithHash> {
  const fileData = await readMarkdownFileData(markdownFile);
  const noteSummary = buildNoteSummaryFromData(markdownFile, fileData);

  return {
    ...noteSummary,
    contentHash: createContentHash(fileData.markdown),
    markdown: fileData.markdown,
  };
}

async function readMarkdownFileData(
  markdownFile: WorkspaceMarkdownFile,
): Promise<MarkdownFileData> {
  const [markdown, fileStats] = await Promise.all([
    readFile(markdownFile.absolutePath, "utf8"),
    stat(markdownFile.absolutePath),
  ]);

  return {
    lastModifiedAt: fileStats.mtime.toISOString(),
    markdown,
    sizeBytes: fileStats.size,
  };
}

function buildNoteSummaryFromData(
  markdownFile: WorkspaceMarkdownFile,
  fileData: MarkdownFileData,
): NoteSummary {
  return {
    fileName: markdownFile.fileName,
    id: markdownFile.relativePath,
    lastModifiedAt: fileData.lastModifiedAt,
    relativePath: markdownFile.relativePath,
    sizeBytes: fileData.sizeBytes,
    title: extractNoteTitle(fileData.markdown, markdownFile.fileName),
  };
}
