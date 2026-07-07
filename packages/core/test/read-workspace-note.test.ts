import { describe, expect, it } from "vitest";

import { readWorkspaceNote } from "../src/index.js";
import { fixtureWorkspacePath } from "./fixture-paths.js";

describe("readWorkspaceNote", () => {
  it("reads a top-level note with raw markdown and metadata", async () => {
    const note = await readWorkspaceNote(fixtureWorkspacePath, "index.md");

    expect(note).toMatchObject({
      fileName: "index.md",
      id: "index.md",
      markdown: "# Welcome Home\n\nThis is the top-level note.\n",
      relativePath: "index.md",
      title: "Welcome Home",
    });
    expect(note.lastModifiedAt).toMatch(/Z$/u);
    expect(note.sizeBytes).toBeGreaterThan(0);
    expect(JSON.stringify(note)).not.toContain(fixtureWorkspacePath);
  });

  it("reads a nested note by slash-separated note ID", async () => {
    const note = await readWorkspaceNote(
      fixtureWorkspacePath,
      "projects/azurite.md",
    );

    expect(note).toMatchObject({
      fileName: "azurite.md",
      id: "projects/azurite.md",
      markdown: "# Azurite\n\nThe project note.\n",
      relativePath: "projects/azurite.md",
      title: "Azurite",
    });
  });

  it("falls back to the file name when a note has no level-one heading", async () => {
    const note = await readWorkspaceNote(fixtureWorkspacePath, "untitled.md");

    expect(note).toMatchObject({
      fileName: "untitled.md",
      id: "untitled.md",
      relativePath: "untitled.md",
      title: "untitled",
    });
  });
});
