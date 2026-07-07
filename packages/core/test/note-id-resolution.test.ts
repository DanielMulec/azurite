import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveNoteIdToMarkdownFile,
  resolveWorkspaceRoot,
} from "../src/index.js";
import { fixtureWorkspacePath } from "./fixture-paths.js";
import { withTemporaryWorkspace } from "./temporary-workspace.js";

describe("resolveNoteIdToMarkdownFile valid IDs", () => {
  it("resolves top-level and nested markdown note IDs", async () => {
    const workspaceRoot = await resolveWorkspaceRoot(fixtureWorkspacePath);

    await expect(
      resolveNoteIdToMarkdownFile(workspaceRoot, "index.md"),
    ).resolves.toMatchObject({
      fileName: "index.md",
      relativePath: "index.md",
    });
    await expect(
      resolveNoteIdToMarkdownFile(workspaceRoot, "projects/azurite.md"),
    ).resolves.toMatchObject({
      fileName: "azurite.md",
      relativePath: "projects/azurite.md",
    });
  });
});

describe("resolveNoteIdToMarkdownFile invalid IDs", () => {
  it.each([
    "../secret.md",
    "./index.md",
    "/absolute/path.md",
    "projects/./azurite.md",
    "ignored.txt",
    ".azurite/cache.md",
    ".git/hooks/readme.md",
    ".obsidian/private.md",
    "node_modules/readme.md",
  ])("rejects unsafe note ID %s", async (noteId) => {
    const workspaceRoot = await resolveWorkspaceRoot(fixtureWorkspacePath);

    await expect(
      resolveNoteIdToMarkdownFile(workspaceRoot, noteId),
    ).rejects.toMatchObject({
      code: "invalid_note_id",
    });
  });
});

describe("resolveNoteIdToMarkdownFile missing targets", () => {
  it("rejects missing notes and directories", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await mkdir(path.join(workspacePath, "directory.md"));
      const workspaceRoot = await resolveWorkspaceRoot(workspacePath);

      await expect(
        resolveNoteIdToMarkdownFile(workspaceRoot, "missing.md"),
      ).rejects.toMatchObject({
        code: "note_not_found",
      });
      await expect(
        resolveNoteIdToMarkdownFile(workspaceRoot, "directory.md"),
      ).rejects.toMatchObject({
        code: "note_not_found",
      });
    });
  });
});

describe("resolveNoteIdToMarkdownFile symlinks", () => {
  it("rejects symlinked notes that escape the workspace", async () => {
    await withTemporaryWorkspace(async ({ outsidePath, workspacePath }) => {
      const outsideNotePath = path.join(outsidePath, "outside.md");
      await writeFile(outsideNotePath, "# Outside\n", "utf8");
      await symlink(outsideNotePath, path.join(workspacePath, "linked.md"));

      const workspaceRoot = await resolveWorkspaceRoot(workspacePath);

      await expect(
        resolveNoteIdToMarkdownFile(workspaceRoot, "linked.md"),
      ).rejects.toMatchObject({
        code: "invalid_note_id",
      });
    });
  });

  it("rejects symlinked note IDs that resolve to non-markdown files", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const textFilePath = path.join(workspacePath, "target.txt");
      await writeFile(textFilePath, "Not markdown.\n", "utf8");
      await symlink(textFilePath, path.join(workspacePath, "alias.md"));

      const workspaceRoot = await resolveWorkspaceRoot(workspacePath);

      await expect(
        resolveNoteIdToMarkdownFile(workspaceRoot, "alias.md"),
      ).rejects.toMatchObject({
        code: "invalid_note_id",
      });
    });
  });
});
