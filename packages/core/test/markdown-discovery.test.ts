import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { discoverMarkdownFiles, resolveWorkspaceRoot } from "../src/index.js";
import { fixtureWorkspacePath } from "./fixture-paths.js";
import { withTemporaryWorkspace } from "./temporary-workspace.js";

describe("discoverMarkdownFiles", () => {
  it("finds markdown files recursively and ignores skipped folders", async () => {
    const workspaceRoot = await resolveWorkspaceRoot(fixtureWorkspacePath);
    const discoveredFiles = await discoverMarkdownFiles(workspaceRoot);

    expect(discoveredFiles.map((file) => file.relativePath)).toEqual([
      "index.md",
      "projects/azurite.md",
      "untitled.md",
    ]);
  });

  it("keeps absolute paths private to core-only metadata", async () => {
    const workspaceRoot = await resolveWorkspaceRoot(fixtureWorkspacePath);
    const discoveredFiles = await discoverMarkdownFiles(workspaceRoot);

    expect(
      discoveredFiles.every((file) => file.relativePath.includes("..")),
    ).toBe(false);
  });

  it("ignores generated and configuration-heavy directories", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await writeFile(path.join(workspacePath, "visible.md"), "# Visible\n");
      await writeIgnoredNote(workspacePath, ".azurite");
      await writeIgnoredNote(workspacePath, ".git");
      await writeIgnoredNote(workspacePath, ".obsidian");
      await writeIgnoredNote(workspacePath, "node_modules");

      const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
      const discoveredFiles = await discoverMarkdownFiles(workspaceRoot);

      expect(discoveredFiles.map((file) => file.relativePath)).toEqual([
        "visible.md",
      ]);
    });
  });
});

async function writeIgnoredNote(
  workspacePath: string,
  directoryName: string,
): Promise<void> {
  const directoryPath = path.join(workspacePath, directoryName);
  await mkdir(directoryPath);
  await writeFile(path.join(directoryPath, "ignored.md"), "# Ignored\n");
}
