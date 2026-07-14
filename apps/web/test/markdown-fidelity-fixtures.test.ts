import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { MarkdownAuthorityController } from "../src/components/markdown-authority-controller.js";
import type { PublicationResult } from "../src/domain/markdown-authority-types.js";
import type { EditorSession } from "../src/state/note-browser-types.js";
import { crlfMarkdownFixture } from "./markdown-fidelity-cases.js";

const fixtureNames = [
  "hyphen-lists.markdown-fixture",
  "mixed-dialect.markdown-fixture",
  "whitespace-choices.markdown-fixture",
  "long-mixed-note.markdown-fixture",
] as const;

describe("sanitized Markdown fidelity fixtures", () => {
  it.each(fixtureNames)("loads %s as exact reusable test data", (name) => {
    const markdown = readFixture(name);

    expect(markdown.length).toBeGreaterThan(100);
    expect(markdown).not.toMatch(/password|api[_-]?key|authorization:/i);
  });

  it("keeps the long mixed-format reproduction at 7,933 characters", () => {
    const markdown = readFixture("long-mixed-note.markdown-fixture");

    expect(markdown).toHaveLength(7_933);
    expect(markdown).toContain("| Field | Value |");
    expect(markdown).toContain("```ts");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("constructs CRLF input independently of Git line-ending handling", () => {
    expect(crlfMarkdownFixture).toContain("\r\n");
    expect(crlfMarkdownFixture.replaceAll("\r\n", "")).not.toContain("\n");
    expect(crlfMarkdownFixture.endsWith("\r\n")).toBe(true);
  });
});

describe("fixture-driven authority checkpoint", () => {
  it("retains exact hyphen source when setup projection uses asterisks", () => {
    const exact = readFixture("hyphen-lists.markdown-fixture");
    const projection = exact.replaceAll(/^([ \t]*)-/gm, "$1*");
    const publish = vi.fn((): PublicationResult => {
      throw new Error("Setup synchronization must not publish.");
    });
    let session = createFixtureSession(exact);
    const controller = new MarkdownAuthorityController({
      isSessionFrozen: () => false,
      onModeChange: (editorMode) => {
        session = { ...session, editorMode, revision: session.revision + 1 };
      },
      publish,
      readProjection: () => projection,
      readSession: (sessionKey) =>
        session.sessionKey === sessionKey ? session : undefined,
      replaceProjection: () => {},
      sessionKey: "fixture-session",
    });

    expect(projection).not.toBe(exact);
    expect(controller.markReady(exact)).toEqual({
      cause: "creation",
      status: "synchronized",
    });
    expect(controller.showSource()).toEqual({ status: "proceed" });
    expect(session).toMatchObject({
      currentMarkdown: exact,
      editorMode: "markdown",
    });
    expect(controller.getSnapshot().rejectedMarkdown).toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
  });
});

function createFixtureSession(markdown: string): EditorSession {
  return {
    baseContentHash: "sha256-fixture",
    currentMarkdown: markdown,
    draftDisposition: "none",
    draftEpoch: 0,
    durableSnapshotKey: undefined,
    editorMode: "wysiwyg",
    lastSnapshotKey: undefined,
    note: {
      contentHash: "sha256-fixture",
      fileName: "hyphen-lists.md",
      id: "hyphen-lists.md",
      lastModifiedAt: "2026-07-14T00:00:00.000Z",
      markdown,
      relativePath: "hyphen-lists.md",
      sizeBytes: markdown.length,
      title: "Hyphen Lists",
    },
    persistenceIssue: undefined,
    preservedSchemaVersion: undefined,
    revision: 0,
    savedMarkdown: markdown,
    saveStatus: "idle",
    sessionKey: "fixture-session",
  };
}

function readFixture(name: (typeof fixtureNames)[number]): string {
  return readFileSync(
    new URL(`./fixtures/markdown-fidelity/${name}`, import.meta.url),
    "utf8",
  );
}
