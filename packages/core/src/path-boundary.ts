import { realpath } from "node:fs/promises";
import path from "node:path";

import type { ResolvedWorkspaceRoot } from "./workspace-root.js";

/** Checks whether a real candidate path stays inside the resolved workspace root. */
export function isPathInsideWorkspace(
  workspaceRoot: ResolvedWorkspaceRoot,
  candidatePath: string,
): boolean {
  const relativePath = path.relative(workspaceRoot.absolutePath, candidatePath);

  return relativePath === "" || isSafeRelativePath(relativePath);
}

/** Resolves a candidate path and returns it only when symlinks still stay inside the workspace. */
export async function resolveCandidatePathInsideWorkspace(
  workspaceRoot: ResolvedWorkspaceRoot,
  candidatePath: string,
): Promise<string | undefined> {
  const realCandidatePath = await readRealCandidatePath(candidatePath);

  if (realCandidatePath === undefined) {
    return undefined;
  }

  if (!isPathInsideWorkspace(workspaceRoot, realCandidatePath)) {
    return undefined;
  }

  return realCandidatePath;
}

/** Converts a safe candidate path into a slash-separated path relative to the workspace. */
export function toWorkspaceRelativePath(
  workspaceRoot: ResolvedWorkspaceRoot,
  candidatePath: string,
): string | undefined {
  if (!isPathInsideWorkspace(workspaceRoot, candidatePath)) {
    return undefined;
  }

  const relativePath = path.relative(workspaceRoot.absolutePath, candidatePath);

  if (relativePath === "") {
    return undefined;
  }

  return relativePath.split(path.sep).join("/");
}

async function readRealCandidatePath(
  candidatePath: string,
): Promise<string | undefined> {
  try {
    return await realpath(candidatePath);
  } catch {
    return undefined;
  }
}

function isSafeRelativePath(relativePath: string): boolean {
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
