import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  listNotesResponseSchema,
  noteSummarySchema,
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

describe("listNotesResponseSchema", () => {
  it("accepts a list of note summaries", () => {
    expect(
      listNotesResponseSchema.parse({ notes: [validNoteSummary] }),
    ).toEqual({
      notes: [validNoteSummary],
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
