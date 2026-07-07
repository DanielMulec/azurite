import type { NoteSummary } from "@azurite/shared";

import { discoverMarkdownFiles } from "./discover-markdown-files.js";
import { buildNoteSummary } from "./note-metadata.js";
import { resolveWorkspaceRoot } from "./workspace-root.js";

/** Safely lists markdown note summaries for a user-provided workspace path. */
export async function listWorkspaceNotes(
  workspacePath: string,
): Promise<NoteSummary[]> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
  const discoveredFiles = await discoverMarkdownFiles(workspaceRoot);
  const noteSummaries = await Promise.all(
    discoveredFiles.map((discoveredFile) => buildNoteSummary(discoveredFile)),
  );

  return noteSummaries.sort(compareNoteSummaries);
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
