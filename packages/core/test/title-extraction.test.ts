import { describe, expect, it } from "vitest";

import { extractNoteTitle } from "../src/index.js";

describe("extractNoteTitle", () => {
  it("uses the first level-one heading as the title", () => {
    expect(extractNoteTitle("# First\n\n# Second\n", "note.md")).toBe("First");
  });

  it("falls back to the file name when no level-one heading exists", () => {
    expect(extractNoteTitle("## Lower heading\n", "untitled.md")).toBe(
      "untitled",
    );
  });

  it("handles empty markdown files", () => {
    expect(extractNoteTitle("", "empty.md")).toBe("empty");
  });

  it("extracts readable text from headings with inline formatting", () => {
    expect(extractNoteTitle("# Hello **Azurite**\n", "note.md")).toBe(
      "Hello Azurite",
    );
  });
});
