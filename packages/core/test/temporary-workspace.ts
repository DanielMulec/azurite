import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type TemporaryWorkspace = {
  readonly outsidePath: string;
  readonly rootPath: string;
  readonly workspacePath: string;
};

export async function withTemporaryWorkspace(
  runTest: (workspace: TemporaryWorkspace) => Promise<void>,
): Promise<void> {
  const rootPath = await mkdtemp(path.join(tmpdir(), "azurite-core-"));
  const workspacePath = path.join(rootPath, "workspace");
  const outsidePath = path.join(rootPath, "outside");
  await mkdir(workspacePath);
  await mkdir(outsidePath);

  try {
    await runTest({ outsidePath, rootPath, workspacePath });
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
}
