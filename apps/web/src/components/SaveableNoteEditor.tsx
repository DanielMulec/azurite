import type { ReactElement } from "react";

import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { EditorSession } from "../state/note-browser-types.js";
import { MilkdownEditor } from "./MilkdownEditor.js";

const blockedSaveStatuses: readonly EditorSession["saveStatus"][] = [
  "conflict",
  "saving",
];

type SaveableNoteEditorProps = {
  readonly editor: EditorSession;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly onEditorModeChange: (editorMode: "markdown" | "wysiwyg") => void;
  readonly onMarkdownChange: (markdown: string) => void;
  readonly onSaveNote: () => Promise<void>;
};

/** Editable note surface with store-owned save and recovery state. */
export function SaveableNoteEditor({
  editor,
  onDiscardDraftAndReloadDiskVersion,
  onEditorModeChange,
  onMarkdownChange,
  onSaveNote,
}: SaveableNoteEditorProps): ReactElement {
  const isDirty = hasDirtyMarkdown(editor);

  return (
    <>
      <SaveToolbar
        editor={editor}
        isDirty={isDirty}
        onDiscardDraftAndReloadDiskVersion={onDiscardDraftAndReloadDiskVersion}
        onSave={onSaveNote}
      />
      <MilkdownEditor
        key={editor.sessionKey}
        initialMarkdown={editor.currentMarkdown}
        initialMode={editor.editorMode}
        noteId={editor.note.id}
        onEditorModeChange={onEditorModeChange}
        onMarkdownChange={onMarkdownChange}
        title={editor.note.title}
      />
    </>
  );
}

function SaveToolbar({
  editor,
  isDirty,
  onDiscardDraftAndReloadDiskVersion,
  onSave,
}: {
  readonly editor: EditorSession;
  readonly isDirty: boolean;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly onSave: () => Promise<void>;
}): ReactElement {
  const showDiscard = editor.recovery === "conflict";

  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-[var(--azurite-border)] pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-[var(--azurite-muted)]">
          {getStatusText(editor, isDirty)}
        </p>
        <div className="flex flex-wrap gap-2">
          {showDiscard ? (
            <button
              className="w-fit border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
              onClick={() => {
                if (confirmDraftDiscard(editor.currentMarkdown)) {
                  void onDiscardDraftAndReloadDiskVersion();
                }
              }}
              type="button"
            >
              Discard draft and reload disk version
            </button>
          ) : null}
          <button
            className="w-fit border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-3 py-1.5 text-sm font-medium text-[var(--azurite-text)] hover:bg-[var(--azurite-hover)] disabled:cursor-not-allowed disabled:text-[var(--azurite-muted)]"
            disabled={!canSave(editor, isDirty)}
            onClick={() => {
              void onSave();
            }}
            type="button"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function getStatusText(editor: EditorSession, isDirty: boolean): string {
  return (
    recoveryStatusText[editor.recovery] ??
    statusText[editor.saveStatus] ??
    getIdleStatusText(isDirty)
  );
}

function getIdleStatusText(isDirty: boolean): string {
  return isDirty ? "Unsaved changes" : "Saved";
}

function canSave(editor: EditorSession, isDirty: boolean): boolean {
  return isDirty && !isSaveBlocked(editor);
}

function isSaveBlocked(editor: EditorSession): boolean {
  return (
    blockedSaveStatuses.includes(editor.saveStatus) ||
    editor.recovery === "conflict"
  );
}

function confirmDraftDiscard(markdown: string): boolean {
  if (markdown.length === 0) {
    return true;
  }

  return window.confirm(
    "Discard this recovered draft and reload the disk version?",
  );
}

function hasDirtyMarkdown(editor: EditorSession): boolean {
  return hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown);
}

const statusText = {
  conflict: "Changed on disk",
  failed: "Save failed",
  idle: undefined,
  saving: "Saving...",
} satisfies Record<EditorSession["saveStatus"], string | undefined>;

const recoveryStatusText = {
  conflict: "Recovered draft changed on disk",
  draft: "Recovered unsaved draft",
  none: undefined,
} satisfies Record<EditorSession["recovery"], string | undefined>;
