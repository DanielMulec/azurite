import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/app.js";

type TemporaryWorkspace = {
  readonly rootPath: string;
  readonly workspacePath: string;
};

describe("notes route", () => {
  it("returns a safe error when no workspace path is configured", async () => {
    const server = createServer({});
    const response = await server.inject({
      method: "GET",
      url: "/api/notes",
    });

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
