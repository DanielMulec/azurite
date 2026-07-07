import { describe, expect, it } from "vitest";

import { listWorkspaceNotes } from "../src/index.js";
import { fixtureWorkspacePath } from "./fixture-paths.js";

describe("listWorkspaceNotes", () => {
  it("builds sorted note summaries without exposing absolute paths", async () => {
    const notes = await listWorkspaceNotes(fixtureWorkspacePath);

    expect(notes.map((note) => note.relativePath)).toEqual([
      "index.md",
      "projects/azurite.md",
      "untitled.md",
    ]);
    expect(notes.map((note) => note.title)).toEqual([
      "Welcome Home",
      "Azurite",
      "untitled",
    ]);
    expect(notes.every((note) => note.id === note.relativePath)).toBe(true);
    expect(notes.every((note) => note.sizeBytes > 0)).toBe(true);
    expect(notes.every((note) => note.lastModifiedAt.endsWith("Z"))).toBe(true);
  });
});
