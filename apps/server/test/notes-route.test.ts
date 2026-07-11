import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  apiErrorCodes,
  apiRoutes,
  correlationHeaderNames,
  createNoteContentRoute,
} from "@azurite/shared";
import { createContentHash } from "@azurite/core";
import { createServer } from "../src/app.js";

type TemporaryWorkspace = {
  readonly rootPath: string;
  readonly workspacePath: string;
};

describe("GET /api/notes", () => {
  it("returns a safe error when no workspace path is configured", async () => {
    const server = createServer({});
    const response = await server.inject({
      method: "GET",
      url: apiRoutes.notes,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: apiErrorCodes.workspaceNotConfigured,
        message: "Workspace path is not configured.",
      },
    });
  });
});

describe("GET /api/notes cluster identity", () => {
  it("returns note summaries for a configured workspace", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n", "utf8");

      const server = createServer({ workspacePath });
      const response = await server.inject({
        method: "GET",
        url: apiRoutes.notes,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        clusterIdentity: {
          status: "ready",
        },
        notes: [
          {
            fileName: "index.md",
            id: "index.md",
            relativePath: "index.md",
            title: "Home",
          },
        ],
      });
      expect(response.body).not.toContain(workspacePath);
      await expect(
        readFile(path.join(workspacePath, ".azurite/cluster.json"), "utf8"),
      ).resolves.toContain("clusterId");
    });
  });

  it("degrades cluster identity when metadata cannot be created", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n", "utf8");
      await writeFile(
        path.join(workspacePath, ".azurite"),
        "not a directory",
        "utf8",
      );

      const server = createServer({ workspacePath });
      const response = await server.inject({
        method: "GET",
        url: apiRoutes.notes,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        clusterIdentity: {
          reason: "metadata_unwritable",
          status: "unavailable",
        },
        notes: [
          {
            id: "index.md",
            title: "Home",
          },
        ],
      });
    });
  });
});

describe("GET /api/notes safe errors", () => {
  it("keeps invalid workspace errors safe", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      const missingWorkspacePath = path.join(workspacePath, "missing-private");
      const server = createServer({ workspacePath: missingWorkspacePath });
      const response = await server.inject({
        method: "GET",
        url: apiRoutes.notes,
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: {
          code: apiErrorCodes.invalidWorkspace,
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
      url: createNoteContentRoute("index.md"),
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: apiErrorCodes.workspaceNotConfigured,
        message: "Workspace path is not configured.",
      },
    });
  });

  it("returns raw markdown content and metadata for a valid note ID", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const projectPath = path.join(workspacePath, "Projects");
      await mkdir(projectPath);
      const markdown = "# Azurite Plan\n\nSlice notes.\n";
      await writeFile(path.join(projectPath, "azurite.md"), markdown, "utf8");

      const server = createServer({ workspacePath });
      const response = await server.inject({
        method: "GET",
        url: createNoteContentRoute("Projects/azurite.md"),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        clusterIdentity: {
          status: "ready",
        },
        note: {
          fileName: "azurite.md",
          contentHash: createContentHash(markdown),
          id: "Projects/azurite.md",
          markdown,
          relativePath: "Projects/azurite.md",
          title: "Azurite Plan",
        },
      });
    });
  });
});

describe("PUT /api/notes/content success", () => {
  it("saves an existing markdown note and returns updated content", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "index.md");
      await writeFile(notePath, "# Home\n", "utf8");

      const server = createServer({ workspacePath });
      const response = await injectSave(server, {
        expectedContentHash: createContentHash("# Home\n"),
        markdown: "# Updated\n",
        noteId: "index.md",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        clusterIdentity: {
          status: "ready",
        },
        note: {
          contentHash: createContentHash("# Updated\n"),
          markdown: "# Updated\n",
          title: "Updated",
        },
      });
      await expect(readFile(notePath, "utf8")).resolves.toBe("# Updated\n");
    });
  });

  it("serializes concurrent same-hash requests into one success and conflict", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "index.md");
      await writeFile(notePath, "# Original\n", "utf8");
      const server = createServer({ workspacePath });
      const payload = {
        expectedContentHash: createContentHash("# Original\n"),
        markdown: "# Winner\n",
        noteId: "index.md",
      };

      const responses = await Promise.all([
        injectSave(server, payload, {
          [correlationHeaderNames.noteOperationId]:
            "30be2dc8-5ff8-46df-838a-d56170c0b752",
          [correlationHeaderNames.requestId]:
            "4f1e6420-59bf-4ec0-b51e-64308be18fee",
        }),
        injectSave(server, payload, {
          [correlationHeaderNames.noteOperationId]:
            "266c4372-08da-4683-a475-c23256fa031a",
          [correlationHeaderNames.requestId]:
            "dde1de07-3015-44ae-b783-bc326e360a55",
        }),
      ]);

      expect(responses.map(({ statusCode }) => statusCode).sort()).toEqual([
        200, 409,
      ]);
      expect(
        responses.find(({ statusCode }) => statusCode === 409)?.json(),
      ).toMatchObject({
        error: { code: apiErrorCodes.noteWriteConflict },
      });
      await expect(readFile(notePath, "utf8")).resolves.toBe("# Winner\n");
    });
  });
});

describe("PUT /api/notes/content safe errors", () => {
  it("returns a safe validation error for invalid save payloads", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const server = createServer({ workspacePath });
      const response = await injectSave(server, {
        markdown: "# Updated\n",
        noteId: "index.md",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: apiErrorCodes.invalidNoteSave,
          message:
            "Save request must include a note ID, markdown, and content hash.",
        },
      });
    });
  });

  it("returns a safe not-found error for missing notes", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      const server = createServer({ workspacePath });
      const response = await injectSave(server, {
        expectedContentHash: createContentHash(""),
        markdown: "# Updated\n",
        noteId: "missing.md",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: {
          code: apiErrorCodes.noteNotFound,
          message: "Requested note was not found.",
        },
      });
      expect(response.body).not.toContain(rootPath);
    });
  });

  it("rejects stale hashes without overwriting the note", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "index.md");
      await writeFile(notePath, "# Changed elsewhere\n", "utf8");

      const server = createServer({ workspacePath });
      const response = await injectSave(server, {
        expectedContentHash: createContentHash("# Home\n"),
        markdown: "# Updated\n",
        noteId: "index.md",
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: {
          code: apiErrorCodes.noteWriteConflict,
          message: "The note changed on disk before Azurite could save it.",
        },
      });
      await expect(readFile(notePath, "utf8")).resolves.toBe(
        "# Changed elsewhere\n",
      );
    });
  });
});

describe("GET /api/notes/content safe errors", () => {
  it("returns safe validation errors for missing and invalid note IDs", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      const server = createServer({ workspacePath });

      await expectInvalidNoteResponse(
        server.inject({ method: "GET", url: apiRoutes.noteContent }),
        rootPath,
      );
      await expectInvalidNoteResponse(
        server.inject({
          method: "GET",
          url: createNoteContentRoute("../secret.md"),
        }),
        rootPath,
      );
      await expectInvalidNoteResponse(
        server.inject({
          method: "GET",
          url: createNoteContentRoute(".obsidian/private.md"),
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
        url: createNoteContentRoute("missing.md"),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: {
          code: apiErrorCodes.noteNotFound,
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

function injectSave(
  server: ReturnType<typeof createServer>,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  return server.inject({
    headers: { "content-type": "application/json", ...headers },
    method: "PUT",
    payload: JSON.stringify(payload),
    url: apiRoutes.noteContent,
  });
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
      code: apiErrorCodes.invalidNoteId,
      message: "Note ID must be a relative markdown path.",
    },
  });
  expect(response.body).not.toContain(rootPath);
}
