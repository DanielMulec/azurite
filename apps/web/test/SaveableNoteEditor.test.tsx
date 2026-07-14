// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaveableNoteEditor } from "../src/components/SaveableNoteEditor.js";
import type { EditorSessionGate } from "../src/components/editor-session-gate.js";
import type { PublicationCommand } from "../src/domain/markdown-authority-types.js";
import type { EditorSession } from "../src/state/note-browser-types.js";
import type { DraftRetryAction } from "../src/persistence/draft-workflow-types.js";
import {
  createAcknowledgingPublisher,
  createTestEditorSessionGate,
} from "./editor-session-gate-test-helpers.js";
import { createMarkdownAuthorityComposition } from "./markdown-authority-composition-test-helpers.js";
import { markdownEqualityCases } from "./markdown-fidelity-cases.js";

vi.mock("../src/components/MilkdownEditor.js", () => ({
  MilkdownEditor: ({
    editor,
    onEditorModeChange,
    onPublishMarkdown,
  }: {
    readonly editor: EditorSession;
    readonly onEditorModeChange?: (mode: "markdown" | "wysiwyg") => void;
    readonly onPublishMarkdown?: (command: PublicationCommand) => unknown;
  }) => (
    <div data-testid="milkdown-editor">
      <p>Mode: {editor.editorMode}</p>
      <pre>{editor.currentMarkdown}</pre>
      <button
        onClick={() => {
          onPublishMarkdown?.({
            markdown: `${editor.currentMarkdown}\nDraft edit`,
            origin: "source_input",
            resolution: "exact_input",
            sessionKey: editor.sessionKey,
            trigger: "direct_input",
          });
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
  readonly onRetryDraftPersistenceIssue?: () => Promise<void>;
  readonly onSaveNote?: () => Promise<void>;
  readonly sessionGate?: EditorSessionGate;
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

  it("blocks save when the visible editor publication is still rejected", () => {
    const composition = createMarkdownAuthorityComposition({
      recovery: "draft",
    });
    const onSaveNote = vi.fn(() => Promise.resolve());
    composition.controller.showSource();
    composition.rejectPublications("state_update_failed");
    expect(
      composition.controller.publishSource("# Visible rejected edit"),
    ).toEqual({
      reason: "state_update_failed",
      status: "rejected",
    });

    renderEditor({
      editor: composition.getEditor(),
      onSaveNote,
      sessionGate: composition.gate,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveNote).not.toHaveBeenCalled();
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

  it.each(markdownEqualityCases)(
    "$name drives the shared Save and status decision",
    ({ current, equal, saved }) => {
      renderEditor({
        editor: createEditor({
          currentMarkdown: current,
          savedMarkdown: saved,
        }),
      });

      expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        equal,
      );
      expect(
        screen.getByText(equal ? "Saved" : "Unsaved changes"),
      ).toBeInTheDocument();
    },
  );
});

describe("SaveableNoteEditor recovery state", () => {
  it.each([
    ["retry_browser_recovery", "Retry browser recovery"],
    ["retry_draft_cleanup", "Retry draft cleanup"],
    ["retry_draft_persistence", "Retry draft persistence"],
  ] as const)(
    "routes %s through the single issue retry callback",
    (action, label) => {
      const onRetryDraftPersistenceIssue = vi.fn(() => Promise.resolve());
      renderEditor({
        editor: createEditor({ persistenceIssue: createIssue(action) }),
        onRetryDraftPersistenceIssue,
      });

      fireEvent.click(screen.getByRole("button", { name: label }));

      expect(onRetryDraftPersistenceIssue).toHaveBeenCalledOnce();
    },
  );

  it("explains how to inspect or dispose of a future-version record", () => {
    renderEditor({
      editor: createEditor({ draftDisposition: "preserved_unknown" }),
    });

    expect(
      screen.getByText(/compatible newer Azurite build/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Discard draft/i }),
    ).not.toBeInTheDocument();
  });

  it("blocks normal save for recovered conflicts and confirms destructive discard", () => {
    const onDiscardDraftAndReloadDiskVersion = vi.fn(() => Promise.resolve());
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderEditor({
      editor: createEditor({
        currentMarkdown: "# Recovered draft",
        draftDisposition: "conflict",
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
  const editor = getEditor(options);

  render(
    <SaveableNoteEditor
      editor={editor}
      onDiscardDraftAndReloadDiskVersion={getDiscardDraftAction(options)}
      onEditorModeChange={getEditorModeAction(options)}
      onPublishMarkdown={getPublisher(options)}
      onRetryDraftPersistenceIssue={
        options.onRetryDraftPersistenceIssue ?? (() => Promise.resolve())
      }
      onSaveNote={getSaveAction(options)}
      readEditorSession={(sessionKey) =>
        sessionKey === editor.sessionKey ? editor : undefined
      }
      sessionGate={options.sessionGate ?? createTestEditorSessionGate()}
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

function getPublisher(options: RenderEditorOptions) {
  const acknowledge = createAcknowledgingPublisher();
  const onMarkdownChange = getMarkdownAction(options);
  return (command: PublicationCommand) => {
    onMarkdownChange(command.markdown);
    return acknowledge(command);
  };
}

function getSaveAction(options: RenderEditorOptions): () => Promise<void> {
  return options.onSaveNote ?? (() => Promise.resolve());
}

function createEditor(patch: Partial<EditorSession> = {}): EditorSession {
  const savedMarkdown = patch.savedMarkdown ?? "# Home";

  return {
    baseContentHash: "sha256-home",
    currentMarkdown: savedMarkdown,
    draftDisposition: "none",
    draftEpoch: 0,
    durableSnapshotKey: undefined,
    editorMode: "wysiwyg",
    lastSnapshotKey: undefined,
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
    persistenceIssue: undefined,
    preservedSchemaVersion: undefined,
    revision: 0,
    savedMarkdown,
    saveStatus: "idle",
    sessionKey: "index.md:sha256-home:1",
    ...patch,
  };
}

function createIssue(retryAction: DraftRetryAction) {
  return {
    clusterId: "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793",
    draftEpoch: 0,
    failure: { reason: "queue_task_failed", source: "coordinator" } as const,
    noteId: "index.md",
    operation: "queue" as const,
    ownerKey: "index.md:sha256-home:1",
    retryAction,
    revision: 0,
    sessionKey: "index.md:sha256-home:1",
    snapshotKey: "index.md:sha256-home:1:0",
  };
}
