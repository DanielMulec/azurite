// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaveableNoteEditor } from "../src/components/SaveableNoteEditor.js";
import type { EditorSession } from "../src/state/note-browser-types.js";

vi.mock("../src/components/MilkdownEditor.js", () => ({
  MilkdownEditor: ({
    initialMarkdown,
    initialMode,
    onEditorModeChange,
    onMarkdownChange,
  }: {
    readonly initialMarkdown: string;
    readonly initialMode: "markdown" | "wysiwyg";
    readonly onEditorModeChange?: (mode: "markdown" | "wysiwyg") => void;
    readonly onMarkdownChange?: (markdown: string) => void;
  }) => (
    <div data-testid="milkdown-editor">
      <p>Mode: {initialMode}</p>
      <pre>{initialMarkdown}</pre>
      <button
        onClick={() => {
          onMarkdownChange?.(`${initialMarkdown}\nDraft edit`);
        }}
        type="button"
      >
        Edit markdown
      </button>
      <button
        onClick={() => {
          onEditorModeChange?.("markdown");
        }}
        type="button"
      >
        Source mode
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type RenderEditorOptions = {
  readonly editor?: EditorSession;
  readonly onDiscardDraftAndReloadDiskVersion?: () => Promise<void>;
  readonly onEditorModeChange?: (mode: "markdown" | "wysiwyg") => void;
  readonly onMarkdownChange?: (markdown: string) => void;
  readonly onSaveNote?: () => Promise<void>;
};

describe("SaveableNoteEditor save state", () => {
  it("shows a saved clean note with save disabled", () => {
    renderEditor();

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("enables save for dirty markdown and forwards editor changes", () => {
    const onMarkdownChange = vi.fn();
    const onSaveNote = vi.fn(() => Promise.resolve());

    renderEditor({
      editor: createEditor({ currentMarkdown: "# Home\nDraft" }),
      onMarkdownChange,
      onSaveNote,
    });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit markdown" }));

    expect(onSaveNote).toHaveBeenCalledTimes(1);
    expect(onMarkdownChange).toHaveBeenCalledWith("# Home\nDraft\nDraft edit");
  });

  it("normalizes CRLF and LF before deciding the note is dirty", () => {
    renderEditor({
      editor: createEditor({
        currentMarkdown: "# Home\r\nLine",
        savedMarkdown: "# Home\nLine",
      }),
    });

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("SaveableNoteEditor recovery state", () => {
  it("blocks normal save for recovered conflicts and confirms destructive discard", () => {
    const onDiscardDraftAndReloadDiskVersion = vi.fn(() => Promise.resolve());
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderEditor({
      editor: createEditor({
        currentMarkdown: "# Recovered draft",
        recovery: "conflict",
        saveStatus: "conflict",
      }),
      onDiscardDraftAndReloadDiskVersion,
    });

    expect(
      screen.getByText("Recovered draft changed on disk"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Discard draft and reload disk version",
      }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Discard this recovered draft and reload the disk version?",
    );
    expect(onDiscardDraftAndReloadDiskVersion).toHaveBeenCalledTimes(1);
  });
});

function renderEditor(options: RenderEditorOptions = {}): void {
  render(
    <SaveableNoteEditor
      editor={getEditor(options)}
      onDiscardDraftAndReloadDiskVersion={getDiscardDraftAction(options)}
      onEditorModeChange={getEditorModeAction(options)}
      onMarkdownChange={getMarkdownAction(options)}
      onSaveNote={getSaveAction(options)}
    />,
  );
}

function getEditor(options: RenderEditorOptions): EditorSession {
  return options.editor ?? createEditor();
}

function getDiscardDraftAction(
  options: RenderEditorOptions,
): () => Promise<void> {
  return (
    options.onDiscardDraftAndReloadDiskVersion ?? (() => Promise.resolve())
  );
}

function getEditorModeAction(
  options: RenderEditorOptions,
): (mode: "markdown" | "wysiwyg") => void {
  return options.onEditorModeChange ?? (() => {});
}

function getMarkdownAction(
  options: RenderEditorOptions,
): (markdown: string) => void {
  return options.onMarkdownChange ?? (() => {});
}

function getSaveAction(options: RenderEditorOptions): () => Promise<void> {
  return options.onSaveNote ?? (() => Promise.resolve());
}

function createEditor(patch: Partial<EditorSession> = {}): EditorSession {
  const savedMarkdown = patch.savedMarkdown ?? "# Home";

  return {
    baseContentHash: "sha256-home",
    currentMarkdown: savedMarkdown,
    editorMode: "wysiwyg",
    note: {
      contentHash: "sha256-home",
      fileName: "index.md",
      id: "index.md",
      lastModifiedAt: "2026-07-08T10:00:00.000Z",
      markdown: savedMarkdown,
      relativePath: "index.md",
      sizeBytes: savedMarkdown.length,
      title: "Home",
    },
    recovery: "none",
    revision: 0,
    savedMarkdown,
    saveStatus: "idle",
    sessionKey: "index.md:sha256-home:1",
    ...patch,
  };
}
