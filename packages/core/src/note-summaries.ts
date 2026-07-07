import type { NoteSummary } from "@azurite/shared";
import { readFile, stat } from "node:fs/promises";

import {
  discoverMarkdownFiles,
  type DiscoveredMarkdownFile,
} from "./discover-markdown-files.js";
import { extractNoteTitle } from "./title-extraction.js";
import { resolveWorkspaceRoot } from "./workspace-root.js";

/** Safely lists markdown note summaries for a user-provided workspace path. */
export async function listWorkspaceNotes(
  workspacePath: string,
): Promise<NoteSummary[]> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
  const discoveredFiles = await discoverMarkdownFiles(workspaceRoot);
  const noteSummaries = await Promise.all(
    discoveredFiles.map(buildNoteSummary),
  );

  return noteSummaries.sort(compareNoteSummaries);
}

async function buildNoteSummary(
  discoveredFile: DiscoveredMarkdownFile,
): Promise<NoteSummary> {
  const markdown = await readFile(discoveredFile.absolutePath, "utf8");
  const fileStats = await stat(discoveredFile.absolutePath);

  return {
    fileName: discoveredFile.fileName,
    id: discoveredFile.relativePath,
    lastModifiedAt: fileStats.mtime.toISOString(),
    relativePath: discoveredFile.relativePath,
    sizeBytes: fileStats.size,
    title: extractNoteTitle(markdown, discoveredFile.fileName),
  };
}

function compareNoteSummaries(first: NoteSummary, second: NoteSummary): number {
  return compareText(first.relativePath, second.relativePath);
}

function compareText(first: string, second: string): number {
  if (first < second) {
    return -1;
  }

  if (first > second) {
    return 1;
  }

  return 0;
}
