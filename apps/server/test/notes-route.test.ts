import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/app.js";

type TemporaryWorkspace = {
  readonly rootPath: string;
  readonly workspacePath: string;
};

describe("GET /api/notes", () => {
  it("returns a safe error when no workspace path is configured", async () => {
    const server = createServer({});
    const response = await server.inject({ method: "GET", url: "/api/notes" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: "workspace_not_configured",
        message: "Workspace path is not configured.",
      },
    });
  });

  it("returns note summaries for a configured workspace", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n", "utf8");

      const server = createServer({ workspacePath });
      const response = await server.inject({
        method: "GET",
        url: "/api/notes",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        notes: [
          {
            fileName: "index.md",
            id: "index.md",
            relativePath: "index.md",
            title: "Home",
          },
        ],
      });
    });
  });

  it("keeps invalid workspace errors safe", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      const missingWorkspacePath = path.join(workspacePath, "missing-private");
      const server = createServer({ workspacePath: missingWorkspacePath });
      const response = await server.inject({
        method: "GET",
        url: "/api/notes",
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: {
          code: "invalid_workspace",
          message: "Configured workspace path is not a readable directory.",
        },
      });
      expect(response.body).not.toContain(rootPath);
    });
  });
});

describe("GET /api/notes/content success", () => {
  it("returns a safe error when no workspace path is configured", async () => {
    const server = createServer({});
    const response = await server.inject({
      method: "GET",
      url: "/api/notes/content?noteId=index.md",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: "workspace_not_configured",
        message: "Workspace path is not configured.",
      },
    });
  });

  it("returns raw markdown content and metadata for a valid note ID", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const projectPath = path.join(workspacePath, "Projects");
      await mkdir(projectPath);
      await writeFile(
        path.join(projectPath, "azurite.md"),
        "# Azurite Plan\n\nSlice notes.\n",
        "utf8",
      );

      const server = createServer({ workspacePath });
      const response = await server.inject({
        method: "GET",
        url: "/api/notes/content?noteId=Projects/azurite.md",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        note: {
          fileName: "azurite.md",
          id: "Projects/azurite.md",
          markdown: "# Azurite Plan\n\nSlice notes.\n",
          relativePath: "Projects/azurite.md",
          title: "Azurite Plan",
        },
      });
    });
  });
});

describe("GET /api/notes/content safe errors", () => {
  it("returns safe validation errors for missing and invalid note IDs", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      const server = createServer({ workspacePath });

      await expectInvalidNoteResponse(
        server.inject({ method: "GET", url: "/api/notes/content" }),
        rootPath,
      );
      await expectInvalidNoteResponse(
        server.inject({
          method: "GET",
          url: "/api/notes/content?noteId=../secret.md",
        }),
        rootPath,
      );
      await expectInvalidNoteResponse(
        server.inject({
          method: "GET",
          url: "/api/notes/content?noteId=.obsidian/private.md",
        }),
        rootPath,
      );
    });
  });

  it("returns a safe not-found error for missing notes", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      const server = createServer({ workspacePath });
      const response = await server.inject({
        method: "GET",
        url: "/api/notes/content?noteId=missing.md",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: {
          code: "note_not_found",
          message: "Requested note was not found.",
        },
      });
      expect(response.body).not.toContain(rootPath);
    });
  });
});

async function withTemporaryWorkspace(
  runTest: (workspace: TemporaryWorkspace) => Promise<void>,
): Promise<void> {
  const rootPath = await mkdtemp(path.join(tmpdir(), "azurite-server-"));
  const workspacePath = path.join(rootPath, "workspace");
  await mkdir(workspacePath);

  try {
    await runTest({ rootPath, workspacePath });
  } finally {
    await rm(rootPath, { force: true, recursive: true });
  }
}

async function expectInvalidNoteResponse(
  responsePromise: Promise<{
    readonly body: string;
    json(): unknown;
    statusCode: number;
  }>,
  rootPath: string,
): Promise<void> {
  const response = await responsePromise;

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    error: {
      code: "invalid_note_id",
      message: "Note ID must be a relative markdown path.",
    },
  });
  expect(response.body).not.toContain(rootPath);
}
