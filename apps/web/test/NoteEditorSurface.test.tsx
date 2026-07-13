// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteEditorSurface } from "../src/components/NoteEditorSurface.js";
import type { NoteViewState } from "../src/state/note-browser-types.js";
import {
  createAcknowledgingPublisher,
  createTestEditorSessionGate,
} from "./editor-session-gate-test-helpers.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NoteEditorSurface", () => {
  it("shows degraded draft recovery outside the ready editor", () => {
    renderSurface(
      {
        noteId: "deleted.md",
        status: "missing",
      },
      {
        draftRecoveryStatus: {
          message: "Draft recovery is unavailable for this cluster.",
          reason: "cluster_identity_unavailable",
          status: "degraded",
        },
      },
    );

    expect(screen.getByText("Note not found")).toBeInTheDocument();
    expect(
      screen.getByText("Draft recovery is unavailable for this cluster."),
    ).toBeInTheDocument();
  });

  it("shows and protects a recovered draft for a missing note", () => {
    const onDiscardMissingDraft = vi.fn(() => Promise.resolve());
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderSurface(
      {
        draft: {
          editorMode: "wysiwyg",
          markdown: "# Deleted but recovered",
          updatedAt: "2026-07-08T10:00:00.000Z",
        },
        draftEpoch: 0,
        noteId: "deleted.md",
        persistenceIssue: undefined,
        renderedOwnerKey: "deleted.md:missing-draft:1",
        status: "missing-draft",
      },
      { onDiscardMissingDraft },
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Recovered draft for missing note",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("# Deleted but recovered")).toHaveAttribute(
      "readonly",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Discard recovered draft" }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Discard this recovered draft?",
    );
    expect(onDiscardMissingDraft).toHaveBeenCalledTimes(1);
  });
});

function renderSurface(
  noteState: NoteViewState,
  options: {
    readonly draftRecoveryStatus?: Parameters<
      typeof NoteEditorSurface
    >[0]["draftRecoveryStatus"];
    readonly onDiscardMissingDraft?: () => Promise<void>;
  } = {},
): void {
  render(
    <NoteEditorSurface
      draftRecoveryStatus={
        options.draftRecoveryStatus ?? { status: "available" }
      }
      noteState={noteState}
      onDiscardDraftAndReloadDiskVersion={() => Promise.resolve()}
      onDiscardMissingDraft={getDiscardMissingDraftAction(options)}
      onEditorModeChange={() => {}}
      onPublishMarkdown={createAcknowledgingPublisher()}
      onRetryBrowserRecovery={() => Promise.resolve()}
      onRetryDraftCleanup={() => Promise.resolve()}
      onRetryDraftPersistence={() => Promise.resolve()}
      onSaveNote={() => Promise.resolve()}
      routeHistoryStatus={{ status: "available" }}
      sessionGate={createTestEditorSessionGate()}
    />,
  );
}

function getDiscardMissingDraftAction(options: {
  readonly onDiscardMissingDraft?: () => Promise<void>;
}): () => Promise<void> {
  return options.onDiscardMissingDraft ?? vi.fn(() => Promise.resolve());
}
