import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { apiErrorCodes, type SaveNoteInput } from "@azurite/shared";
import {
  createContentHash,
  KeyedTaskCoordinator,
  NoteResolutionError,
  NoteWriteError,
  writeWorkspaceNote,
} from "../src/index.js";
import { withTemporaryWorkspace } from "./temporary-workspace.js";

describe("writeWorkspaceNote success", () => {
  it("writes an existing markdown note and returns a new content hash", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "index.md");
      await writeFile(notePath, "# Home\n", "utf8");

      const note = await writeWorkspaceNote(
        workspacePath,
        saveInput("index.md", "# Updated\n", "# Home\n"),
      );

      await expect(readFile(notePath, "utf8")).resolves.toBe("# Updated\n");
      expect(note).toMatchObject({
        contentHash: createContentHash("# Updated\n"),
        markdown: "# Updated\n",
        title: "Updated",
      });
    });
  });

  it("preserves CRLF-dominant line endings", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "windows.md");
      const originalMarkdown = "# Windows\r\n\r\nLine one\r\nLine two\n";
      await writeFile(notePath, originalMarkdown, "utf8");

      await writeWorkspaceNote(
        workspacePath,
        saveInput(
          "windows.md",
          "# Updated\n\nLine one\nLine two\n",
          originalMarkdown,
        ),
      );

      await expect(readFile(notePath, "utf8")).resolves.toBe(
        "# Updated\r\n\r\nLine one\r\nLine two\r\n",
      );
    });
  });

  it("does not leave a temporary file behind after a successful save", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await mkdir(path.join(workspacePath, "notes"));
      await writeFile(path.join(workspacePath, "notes/index.md"), "# Home\n");

      await writeWorkspaceNote(
        workspacePath,
        saveInput("notes/index.md", "# Updated\n", "# Home\n"),
      );

      await expect(readdir(path.join(workspacePath, "notes"))).resolves.toEqual(
        ["index.md"],
      );
    });
  });
});

describe("writeWorkspaceNote safe errors", () => {
  it("allows one of two concurrent same-hash writes and conflicts the other", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "index.md");
      await writeFile(notePath, "# Original\n", "utf8");
      const input = saveInput("index.md", "# Winner\n", "# Original\n");

      const results = await Promise.allSettled([
        writeWorkspaceNote(workspacePath, input),
        writeWorkspaceNote(workspacePath, input),
      ]);

      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === "rejected"),
      ).toMatchObject({ reason: { code: apiErrorCodes.noteWriteConflict } });
      await expect(readFile(notePath, "utf8")).resolves.toBe("# Winner\n");
    });
  });

  it("rejects stale save requests without overwriting the file", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const notePath = path.join(workspacePath, "index.md");
      await writeFile(notePath, "# Changed elsewhere\n", "utf8");

      const request = writeWorkspaceNote(workspacePath, {
        expectedContentHash: createContentHash("# Original\n"),
        markdown: "# From Azurite\n",
        noteId: "index.md",
      });

      await expect(request).rejects.toMatchObject({
        code: apiErrorCodes.noteWriteConflict,
      } satisfies Partial<NoteWriteError>);
      await expect(readFile(notePath, "utf8")).resolves.toBe(
        "# Changed elsewhere\n",
      );
    });
  });

  it("reuses existing note ID validation for writes", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const request = writeWorkspaceNote(
        workspacePath,
        saveInput("../secret.md", "# Updated\n", "# Original\n"),
      );

      await expect(request).rejects.toMatchObject({
        code: apiErrorCodes.invalidNoteId,
      } satisfies Partial<NoteResolutionError>);
    });
  });
});

describe("KeyedTaskCoordinator", () => {
  it("releases failed keys and removes them when idle", async () => {
    const coordinator = new KeyedTaskCoordinator();
    await expect(
      coordinator.run("note", () => Promise.reject(new Error("failed"))),
    ).rejects.toThrow("failed");
    await expect(
      coordinator.run("note", () => Promise.resolve("recovered")),
    ).resolves.toBe("recovered");
    expect(coordinator.activeKeyCount).toBe(0);
  });

  it("does not globally serialize different keys", async () => {
    const coordinator = new KeyedTaskCoordinator();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = coordinator.run("first", () => firstGate);
    const secondTask = vi.fn(() => Promise.resolve("second"));
    const second = coordinator.run("second", secondTask);

    await expect(second).resolves.toBe("second");
    expect(secondTask).toHaveBeenCalledTimes(1);
    releaseFirst();
    await first;
    expect(coordinator.activeKeyCount).toBe(0);
  });
});

function saveInput(
  noteId: string,
  markdown: string,
  currentMarkdown: string,
): SaveNoteInput {
  return {
    expectedContentHash: createContentHash(currentMarkdown),
    markdown,
    noteId,
  };
}
