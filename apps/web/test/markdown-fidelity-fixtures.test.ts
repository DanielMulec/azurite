import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { MarkdownAuthorityController } from "../src/components/markdown-authority-controller.js";
import type { PublicationResult } from "../src/domain/markdown-authority-types.js";
import { crlfMarkdownFixture } from "./markdown-fidelity-cases.js";

const fixtureNames = [
  "hyphen-lists.md",
  "mixed-dialect.md",
  "whitespace-choices.md",
  "long-mixed-note.md",
] as const;

describe("sanitized Markdown fidelity fixtures", () => {
  it.each(fixtureNames)("loads %s as exact reusable test data", (name) => {
    const markdown = readFixture(name);

    expect(markdown.length).toBeGreaterThan(100);
    expect(markdown).not.toMatch(/password|api[_-]?key|authorization:/i);
  });

  it("keeps the long mixed-format reproduction at 7,933 characters", () => {
    const markdown = readFixture("long-mixed-note.md");

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
    const exact = readFixture("hyphen-lists.md");
    const projection = exact.replaceAll(/^([ \t]*)-/gm, "$1*");
    const publish = vi.fn((): PublicationResult => {
      throw new Error("Setup synchronization must not publish.");
    });
    const controller = new MarkdownAuthorityController({
      initialDisposition: "none",
      initialMarkdown: exact,
      initialMode: "wysiwyg",
      initialRevision: 0,
      onModeChange: () => {},
      publish,
      readProjection: () => projection,
      replaceProjection: () => {},
      sessionKey: "fixture-session",
    });

    expect(projection).not.toBe(exact);
    expect(controller.markReady()).toMatchObject({
      exactAuthority: exact,
      projection,
      stateEffect: "none",
      status: "synchronized",
    });
    expect(controller.showSource()).toMatchObject({ status: "no_change" });
    expect(controller.getSnapshot().sourceMarkdown).toBe(exact);
    expect(publish).not.toHaveBeenCalled();
  });
});

function readFixture(name: (typeof fixtureNames)[number]): string {
  return readFileSync(
    new URL(`./fixtures/markdown-fidelity/${name}`, import.meta.url),
    "utf8",
  );
}
