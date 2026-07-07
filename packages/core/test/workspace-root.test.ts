import { realpath } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceRoot,
  WorkspaceResolutionError,
} from "../src/index.js";
import { fixtureWorkspacePath } from "./fixture-paths.js";

describe("resolveWorkspaceRoot", () => {
  it("accepts an existing directory and resolves it to the real path", async () => {
    const resolvedRoot = await resolveWorkspaceRoot(
      path.join(fixtureWorkspacePath, "."),
    );

    expect(resolvedRoot.absolutePath).toBe(
      await realpath(fixtureWorkspacePath),
    );
  });

  it("rejects a missing path", async () => {
    await expect(
      resolveWorkspaceRoot(path.join(fixtureWorkspacePath, "missing")),
    ).rejects.toMatchObject({
      code: "workspace_not_found",
    });
  });

  it("rejects a regular file", async () => {
    await expect(
      resolveWorkspaceRoot(path.join(fixtureWorkspacePath, "ignored.txt")),
    ).rejects.toBeInstanceOf(WorkspaceResolutionError);
  });
});
