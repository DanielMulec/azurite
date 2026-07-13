import type { ReactElement } from "react";

import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { canSaveEditor } from "../state/note-browser-action-utils.js";
import type { EditorSession } from "../state/note-browser-types.js";
import type { EditorSessionGate } from "./editor-session-gate.js";
import { MilkdownEditor } from "./MilkdownEditor.js";

type SaveableNoteEditorProps = {
  readonly editor: EditorSession;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly onEditorModeChange: (editorMode: "markdown" | "wysiwyg") => void;
  readonly onPublishMarkdown: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly onSaveNote: () => Promise<void>;
  readonly sessionGate: EditorSessionGate;
};

/** Editable note surface with store-owned save and recovery state. */
export function SaveableNoteEditor({
  editor,
  onDiscardDraftAndReloadDiskVersion,
  onEditorModeChange,
  onPublishMarkdown,
  onSaveNote,
  sessionGate,
}: SaveableNoteEditorProps): ReactElement {
  const isDirty = hasDirtyMarkdown(editor);

  return (
    <>
      <SaveToolbar
        editor={editor}
        isDirty={isDirty}
        onDiscardDraftAndReloadDiskVersion={onDiscardDraftAndReloadDiskVersion}
        onSave={async () => {
          const commit = sessionGate.commitCurrent("manual_save");
          if (commit?.status !== "failed") {
            await onSaveNote();
          }
        }}
        sessionGate={sessionGate}
      />
      <MilkdownEditor
        initialDisposition={editor.draftDisposition}
        initialMarkdown={editor.currentMarkdown}
        initialMode={editor.editorMode}
        initialRevision={editor.revision}
        noteId={editor.note.id}
        onEditorModeChange={onEditorModeChange}
        onPublishMarkdown={onPublishMarkdown}
        sessionGate={sessionGate}
        sessionKey={editor.sessionKey}
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
  sessionGate,
}: {
  readonly editor: EditorSession;
  readonly isDirty: boolean;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly onSave: () => Promise<void>;
  readonly sessionGate: EditorSessionGate;
}): ReactElement {
  const showDiscard =
    editor.draftDisposition === "recovered" ||
    editor.draftDisposition === "conflict";

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
                  void sessionGate.runTerminalAction(
                    editor.sessionKey,
                    onDiscardDraftAndReloadDiskVersion,
                  );
                }
              }}
              type="button"
            >
              Discard draft and reload disk version
            </button>
          ) : null}
          <button
            className="w-fit border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-3 py-1.5 text-sm font-medium text-[var(--azurite-text)] hover:bg-[var(--azurite-hover)] disabled:cursor-not-allowed disabled:text-[var(--azurite-muted)]"
            disabled={!canSaveEditor(editor)}
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
    draftDispositionStatusText[editor.draftDisposition] ??
    statusText[editor.saveStatus] ??
    getIdleStatusText(isDirty)
  );
}

function getIdleStatusText(isDirty: boolean): string {
  return isDirty ? "Unsaved changes" : "Saved";
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

const draftDispositionStatusText = {
  cleanup_required: "Saved; browser draft cleanup needs retry",
  conflict: "Recovered draft changed on disk",
  generated_durable: undefined,
  generated_pending: undefined,
  none: undefined,
  preserved_unknown: "A newer Azurite build owns this recovery record",
  recovered: "Recovered unsaved draft",
  recovery_read_unavailable: "Browser recovery could not be read",
} satisfies Record<EditorSession["draftDisposition"], string | undefined>;
