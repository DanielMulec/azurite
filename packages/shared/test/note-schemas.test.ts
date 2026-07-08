import { describe, expect, it } from "vitest";

import {
  listNotesResponseSchema,
  markdownNoteFileExtension,
  noteContentSchema,
  noteContentWithHashSchema,
  noteIdInputSchema,
  noteSummarySchema,
  readNoteResponseSchema,
  saveNoteInputSchema,
  saveNoteResponseSchema,
  workspacePathInputSchema,
} from "../src/index.js";

const validNoteSummary = {
  fileName: "index.md",
  id: "notes/index.md",
  lastModifiedAt: "2026-07-07T12:00:00.000Z",
  relativePath: "notes/index.md",
  sizeBytes: 42,
  title: "Index",
};
const validNoteContent = {
  ...validNoteSummary,
  markdown: "# Index\n",
};
const validNoteContentWithHash = {
  ...validNoteContent,
  contentHash: "sha256-example",
};

describe("markdownNoteFileExtension", () => {
  it("names the currently supported markdown note extension", () => {
    expect(markdownNoteFileExtension).toBe(".md");
  });
});

describe("workspacePathInputSchema", () => {
  it("accepts a non-empty workspace path", () => {
    expect(
      workspacePathInputSchema.parse({ workspacePath: "/Users/daniel/Notes" }),
    ).toEqual({
      workspacePath: "/Users/daniel/Notes",
    });
  });

  it("rejects an empty workspace path", () => {
    expect(() =>
      workspacePathInputSchema.parse({ workspacePath: "" }),
    ).toThrow();
  });
});

describe("noteSummarySchema", () => {
  it("accepts a safe note summary shape", () => {
    expect(noteSummarySchema.parse(validNoteSummary)).toEqual(validNoteSummary);
  });

  it("rejects invalid note metadata", () => {
    expect(() =>
      noteSummarySchema.parse({
        ...validNoteSummary,
        lastModifiedAt: "not a date",
        sizeBytes: -1,
      }),
    ).toThrow();
  });
});

describe("noteIdInputSchema", () => {
  it("accepts relative markdown note IDs", () => {
    expect(noteIdInputSchema.parse({ noteId: "index.md" })).toEqual({
      noteId: "index.md",
    });
    expect(noteIdInputSchema.parse({ noteId: "Projects/azurite.md" })).toEqual({
      noteId: "Projects/azurite.md",
    });
  });

  it.each([
    "",
    "/absolute/path.md",
    "./index.md",
    "../secret.md",
    "Projects/./azurite.md",
    "Projects/../secret.md",
    "Projects//azurite.md",
    ".azurite/cache.md",
    ".git/hooks/readme.md",
    ".obsidian/private.md",
    "node_modules/readme.md",
    "ignored.txt",
  ])("rejects unsafe note ID %s", (noteId) => {
    expect(() => noteIdInputSchema.parse({ noteId })).toThrow();
  });
});

describe("noteContentSchema", () => {
  it("accepts raw markdown plus safe note metadata", () => {
    expect(noteContentSchema.parse(validNoteContent)).toEqual(validNoteContent);
  });
});

describe("noteContentWithHashSchema", () => {
  it("accepts raw markdown plus a content hash", () => {
    expect(noteContentWithHashSchema.parse(validNoteContentWithHash)).toEqual(
      validNoteContentWithHash,
    );
  });
});

describe("listNotesResponseSchema", () => {
  it("accepts a list of note summaries", () => {
    expect(
      listNotesResponseSchema.parse({ notes: [validNoteSummary] }),
    ).toEqual({
      notes: [validNoteSummary],
    });
  });
});

describe("readNoteResponseSchema", () => {
  it("accepts one note content object with a hash", () => {
    expect(
      readNoteResponseSchema.parse({ note: validNoteContentWithHash }),
    ).toEqual({
      note: validNoteContentWithHash,
    });
  });
});

describe("saveNoteInputSchema", () => {
  it("accepts a manual save payload for an existing note", () => {
    expect(
      saveNoteInputSchema.parse({
        expectedContentHash: "sha256-before",
        markdown: "# Updated\n",
        noteId: "notes/index.md",
      }),
    ).toEqual({
      expectedContentHash: "sha256-before",
      markdown: "# Updated\n",
      noteId: "notes/index.md",
    });
  });

  it("rejects unsafe note IDs and empty hashes", () => {
    expect(() =>
      saveNoteInputSchema.parse({
        expectedContentHash: "",
        markdown: "# Updated\n",
        noteId: "../secret.md",
      }),
    ).toThrow();
  });
});

describe("saveNoteResponseSchema", () => {
  it("accepts one saved note content object with a hash", () => {
    expect(
      saveNoteResponseSchema.parse({ note: validNoteContentWithHash }),
    ).toEqual({
      note: validNoteContentWithHash,
    });
  });
});
