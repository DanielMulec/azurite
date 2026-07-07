import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  listNotesResponseSchema,
  noteContentSchema,
  noteIdInputSchema,
  noteSummarySchema,
  readNoteResponseSchema,
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
  it("accepts one note content object", () => {
    expect(readNoteResponseSchema.parse({ note: validNoteContent })).toEqual({
      note: validNoteContent,
    });
  });
});

describe("apiErrorResponseSchema", () => {
  it("accepts a safe error response", () => {
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: "workspace_not_configured",
          message: "Workspace path is not configured.",
        },
      }),
    ).toEqual({
      error: {
        code: "workspace_not_configured",
        message: "Workspace path is not configured.",
      },
    });
  });
});
