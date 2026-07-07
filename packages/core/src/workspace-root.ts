import { realpath, stat } from "node:fs/promises";
import path from "node:path";

/** Verified workspace root that has already passed filesystem existence checks. */
export type ResolvedWorkspaceRoot = {
  readonly absolutePath: string;
};

/** Stable reason code for workspace root resolution failures. */
export type WorkspaceResolutionErrorCode =
  "workspace_not_directory" | "workspace_not_found";

/** Error thrown when a user-provided workspace path cannot become a safe root. */
export class WorkspaceResolutionError extends Error {
  readonly code: WorkspaceResolutionErrorCode;

  constructor(code: WorkspaceResolutionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "WorkspaceResolutionError";
  }
}

/** Resolves user-provided text into a real directory path Azurite can trust. */
export async function resolveWorkspaceRoot(
  workspacePath: string,
): Promise<ResolvedWorkspaceRoot> {
  const absoluteWorkspacePath = path.resolve(workspacePath);
  const realWorkspacePath = await readRealWorkspacePath(absoluteWorkspacePath);
  const workspaceStats = await stat(realWorkspacePath);

  if (!workspaceStats.isDirectory()) {
    throw new WorkspaceResolutionError(
      "workspace_not_directory",
      "Workspace path must point to a directory.",
    );
  }

  return { absolutePath: realWorkspacePath };
}

async function readRealWorkspacePath(workspacePath: string): Promise<string> {
  try {
    return await realpath(workspacePath);
  } catch {
    throw new WorkspaceResolutionError(
      "workspace_not_found",
      "Workspace path does not exist.",
    );
  }
}
