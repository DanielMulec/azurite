import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  discoverMarkdownFiles,
  isPathInsideWorkspace,
  resolveWorkspaceRoot,
} from "../src/index.js";
import { withTemporaryWorkspace } from "./temporary-workspace.js";

describe("workspace path boundary", () => {
  it("rejects candidate paths outside the workspace", async () => {
    await withTemporaryWorkspace(async ({ outsidePath, workspacePath }) => {
      const workspaceRoot = await resolveWorkspaceRoot(workspacePath);

      expect(isPathInsideWorkspace(workspaceRoot, outsidePath)).toBe(false);
    });
  });

  it("ignores symlinked files and directories that escape the workspace", async () => {
    await withTemporaryWorkspace(
      async ({ outsidePath, rootPath, workspacePath }) => {
        const outsideNotePath = path.join(outsidePath, "outside.md");
        const outsideDirectoryPath = path.join(
          outsidePath,
          "outside-directory",
        );
        await writeFile(outsideNotePath, "# Outside\n", "utf8");
        await mkdir(outsideDirectoryPath);
        await writeFile(
          path.join(outsideDirectoryPath, "nested.md"),
          "# Nested\n",
        );
        await symlink(outsideNotePath, path.join(workspacePath, "linked.md"));
        await symlink(
          outsideDirectoryPath,
          path.join(workspacePath, "linked-dir"),
        );

        const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
        const discoveredFiles = await discoverMarkdownFiles(workspaceRoot);

        expect(discoveredFiles).toEqual([]);
        expect(rootPath).toContain("azurite-core-");
      },
    );
  });
});
