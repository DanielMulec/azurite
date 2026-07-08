import {
  apiErrorCodes,
  type NoteContentWithHash,
  type SaveNoteInput,
} from "@azurite/shared";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";

import { WebApiError } from "../api-client.js";
import { MilkdownEditor } from "./MilkdownEditor.js";

type SaveStatus = "conflict" | "failed" | "idle" | "saving";

type SaveableNoteEditorProps = {
  readonly note: NoteContentWithHash;
  readonly onSaveNote: (input: SaveNoteInput) => Promise<NoteContentWithHash>;
};

/** Editable note surface with manual save state for one existing markdown note. */
export function SaveableNoteEditor({
  note,
  onSaveNote,
}: SaveableNoteEditorProps): ReactElement {
  return (
    <SaveableNoteSession
      key={`${note.id}:${note.contentHash}`}
      note={note}
      onSaveNote={onSaveNote}
    />
  );
}

function SaveableNoteSession({
  note,
  onSaveNote,
}: SaveableNoteEditorProps): ReactElement {
  const [contentHash, setContentHash] = useState(note.contentHash);
  const [currentMarkdown, setCurrentMarkdown] = useState(note.markdown);
  const [savedMarkdown, setSavedMarkdown] = useState(note.markdown);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const isDirty =
    normalizeEditorMarkdown(currentMarkdown) !==
    normalizeEditorMarkdown(savedMarkdown);
  const handleMarkdownChange = useCallback((markdown: string) => {
    setCurrentMarkdown(markdown);
    setSaveStatus((current) => (current === "conflict" ? current : "idle"));
  }, []);

  return (
    <>
      <SaveToolbar
        isDirty={isDirty}
        onSave={() => {
          void saveCurrentMarkdown({
            contentHash,
            currentMarkdown,
            noteId: note.id,
            onSaveNote,
            setContentHash,
            setCurrentMarkdown,
            setSaveStatus,
            setSavedMarkdown,
          });
        }}
        status={saveStatus}
      />
      <MilkdownEditor
        initialMarkdown={note.markdown}
        noteId={note.id}
        onMarkdownChange={handleMarkdownChange}
        title={note.title}
      />
    </>
  );
}

function SaveToolbar({
  isDirty,
  onSave,
  status,
}: {
  readonly isDirty: boolean;
  readonly onSave: () => void;
  readonly status: SaveStatus;
}): ReactElement {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-[var(--azurite-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p aria-live="polite" className="text-sm text-[var(--azurite-muted)]">
        {getStatusText(status, isDirty)}
      </p>
      <button
        className="w-fit border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-3 py-1.5 text-sm font-medium text-[var(--azurite-text)] hover:bg-[var(--azurite-hover)] disabled:cursor-not-allowed disabled:text-[var(--azurite-muted)]"
        disabled={!canSave(status, isDirty)}
        onClick={onSave}
        type="button"
      >
        Save
      </button>
    </div>
  );
}

function getStatusText(status: SaveStatus, isDirty: boolean): string {
  return statusText[status] ?? getIdleStatusText(isDirty);
}

function getIdleStatusText(isDirty: boolean): string {
  return isDirty ? "Unsaved changes" : "Saved";
}

function canSave(status: SaveStatus, isDirty: boolean): boolean {
  return status !== "saving" && status !== "conflict" && isDirty;
}

function normalizeEditorMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n");
}

async function saveCurrentMarkdown(request: SaveCurrentMarkdownRequest) {
  request.setSaveStatus("saving");

  try {
    const note = await request.onSaveNote({
      expectedContentHash: request.contentHash,
      markdown: request.currentMarkdown,
      noteId: request.noteId,
    });
    handleSaveSuccess(request, note);
  } catch (error) {
    request.setSaveStatus(getFailureStatus(error));
  }
}

function handleSaveSuccess(
  request: SaveCurrentMarkdownRequest,
  note: NoteContentWithHash,
): void {
  request.setContentHash(note.contentHash);
  request.setCurrentMarkdown(note.markdown);
  request.setSavedMarkdown(note.markdown);
  request.setSaveStatus("idle");
}

function getFailureStatus(error: unknown): SaveStatus {
  if (isWriteConflict(error)) {
    return "conflict";
  }

  return "failed";
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof WebApiError &&
    error.code === apiErrorCodes.noteWriteConflict
  );
}

type SaveCurrentMarkdownRequest = {
  readonly contentHash: string;
  readonly currentMarkdown: string;
  readonly noteId: string;
  readonly onSaveNote: (input: SaveNoteInput) => Promise<NoteContentWithHash>;
  readonly setContentHash: (contentHash: string) => void;
  readonly setCurrentMarkdown: (markdown: string) => void;
  readonly setSaveStatus: (status: SaveStatus) => void;
  readonly setSavedMarkdown: (markdown: string) => void;
};

const statusText = {
  conflict: "Changed on disk",
  failed: "Save failed",
  idle: undefined,
  saving: "Saving...",
} satisfies Record<SaveStatus, string | undefined>;
