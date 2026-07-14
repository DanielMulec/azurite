import type { ReactElement } from "react";

import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftRetryAction } from "../persistence/draft-workflow-types.js";
import { canSaveEditor } from "../state/note-browser-action-utils.js";
import type { EditorSession } from "../state/note-browser-types.js";
import type { EditorSessionReader } from "../state/note-browser-types.js";
import type { EditorSessionGate } from "./editor-session-gate.js";
import { MilkdownEditor } from "./MilkdownEditor.js";

type SaveableNoteEditorProps = {
  readonly editor: EditorSession;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<unknown>;
  readonly onEditorModeChange: (editorMode: "markdown" | "wysiwyg") => void;
  readonly onPublishMarkdown: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly onRetryBrowserRecovery: () => Promise<unknown>;
  readonly onRetryDraftCleanup: () => Promise<void>;
  readonly onRetryDraftPersistence: () => Promise<void>;
  readonly onSaveNote: () => Promise<void>;
  readonly readEditorSession: EditorSessionReader;
  readonly sessionGate: EditorSessionGate;
};

/** Editable note surface with store-owned save and recovery state. */
export function SaveableNoteEditor({
  editor,
  onDiscardDraftAndReloadDiskVersion,
  onEditorModeChange,
  onPublishMarkdown,
  onRetryBrowserRecovery,
  onRetryDraftCleanup,
  onRetryDraftPersistence,
  onSaveNote,
  readEditorSession,
  sessionGate,
}: SaveableNoteEditorProps): ReactElement {
  const isDirty = hasMarkdownDifference(
    editor.currentMarkdown,
    editor.savedMarkdown,
  );

  return (
    <>
      <SaveToolbar
        editor={editor}
        isDirty={isDirty}
        onDiscardDraftAndReloadDiskVersion={onDiscardDraftAndReloadDiskVersion}
        onSave={async () => {
          const commit = sessionGate.commitCurrent("manual_save");
          if (commit?.status !== "block") {
            await onSaveNote();
          }
        }}
        onRetryBrowserRecovery={onRetryBrowserRecovery}
        onRetryDraftCleanup={onRetryDraftCleanup}
        onRetryDraftPersistence={onRetryDraftPersistence}
        sessionGate={sessionGate}
      />
      <MilkdownEditor
        editor={editor}
        onEditorModeChange={onEditorModeChange}
        onPublishMarkdown={onPublishMarkdown}
        readEditorSession={readEditorSession}
        sessionGate={sessionGate}
      />
    </>
  );
}

function SaveToolbar({
  editor,
  isDirty,
  onDiscardDraftAndReloadDiskVersion,
  onRetryBrowserRecovery,
  onRetryDraftCleanup,
  onRetryDraftPersistence,
  onSave,
  sessionGate,
}: {
  readonly editor: EditorSession;
  readonly isDirty: boolean;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<unknown>;
  readonly onRetryBrowserRecovery: () => Promise<unknown>;
  readonly onRetryDraftCleanup: () => Promise<void>;
  readonly onRetryDraftPersistence: () => Promise<void>;
  readonly onSave: () => Promise<void>;
  readonly sessionGate: EditorSessionGate;
}): ReactElement {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-[var(--azurite-border)] pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-sm text-[var(--azurite-muted)]">
          {getStatusText(editor, isDirty)}
        </p>
        <div className="flex flex-wrap gap-2">
          <DiscardButton
            editor={editor}
            onDiscard={onDiscardDraftAndReloadDiskVersion}
            sessionGate={sessionGate}
          />
          <DraftRetryButton
            editor={editor}
            onRetryBrowserRecovery={onRetryBrowserRecovery}
            onRetryDraftCleanup={onRetryDraftCleanup}
            onRetryDraftPersistence={onRetryDraftPersistence}
          />
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
      <FutureRecordGuidance editor={editor} />
    </div>
  );
}

function FutureRecordGuidance({
  editor,
}: {
  readonly editor: EditorSession;
}): ReactElement | null {
  return editor.draftDisposition === "preserved_unknown" ? (
    <p className="text-sm leading-6 text-[var(--azurite-muted)]">
      A compatible newer Azurite build is required to inspect or dispose of this
      recovery record.
    </p>
  ) : null;
}

function DraftRetryButton(props: {
  readonly editor: EditorSession;
  readonly onRetryBrowserRecovery: () => Promise<unknown>;
  readonly onRetryDraftCleanup: () => Promise<void>;
  readonly onRetryDraftPersistence: () => Promise<void>;
}): ReactElement | null {
  const control = getEditorRetryControl(props);
  if (control === undefined) {
    return null;
  }
  return (
    <button
      className="w-fit border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
      onClick={() => {
        void control.run();
      }}
      type="button"
    >
      {control.label}
    </button>
  );
}

function DiscardButton(props: {
  readonly editor: EditorSession;
  readonly onDiscard: () => Promise<unknown>;
  readonly sessionGate: EditorSessionGate;
}): ReactElement | null {
  if (!isDiscardable(props.editor)) {
    return null;
  }
  return (
    <button
      className="w-fit border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
      onClick={() => {
        runConfirmedDiscard(props);
      }}
      type="button"
    >
      {getDiscardLabel(props.editor)}
    </button>
  );
}

function getDiscardLabel(editor: EditorSession): string {
  return editor.persistenceIssue?.retryAction === "retry_discard"
    ? "Retry discard"
    : "Discard draft and reload disk version";
}

function getEditorRetryControl(props: {
  readonly editor: EditorSession;
  readonly onRetryBrowserRecovery: () => Promise<unknown>;
  readonly onRetryDraftCleanup: () => Promise<void>;
  readonly onRetryDraftPersistence: () => Promise<void>;
}):
  { readonly label: string; readonly run: () => Promise<unknown> } | undefined {
  const action = props.editor.persistenceIssue?.retryAction;
  return action === undefined ? undefined : getRetryControl(action, props);
}

function runConfirmedDiscard(props: {
  readonly editor: EditorSession;
  readonly onDiscard: () => Promise<unknown>;
  readonly sessionGate: EditorSessionGate;
}): void {
  if (confirmDraftDiscard(props.editor.currentMarkdown)) {
    void props.sessionGate.runTerminalAction(
      props.editor.sessionKey,
      props.onDiscard,
    );
  }
}

function isDiscardable(editor: EditorSession): boolean {
  return (
    editor.draftDisposition === "recovered" ||
    editor.draftDisposition === "conflict"
  );
}

function getRetryControl(
  action: DraftRetryAction,
  props: {
    readonly onRetryBrowserRecovery: () => Promise<unknown>;
    readonly onRetryDraftCleanup: () => Promise<void>;
    readonly onRetryDraftPersistence: () => Promise<void>;
  },
):
  { readonly label: string; readonly run: () => Promise<unknown> } | undefined {
  const controls = {
    retry_browser_recovery: {
      label: retryActionLabels.retry_browser_recovery,
      run: props.onRetryBrowserRecovery,
    },
    retry_discard: undefined,
    retry_draft_cleanup: {
      label: retryActionLabels.retry_draft_cleanup,
      run: props.onRetryDraftCleanup,
    },
    retry_draft_persistence: {
      label: retryActionLabels.retry_draft_persistence,
      run: props.onRetryDraftPersistence,
    },
  } as const;
  return controls[action];
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

const retryActionLabels = {
  retry_browser_recovery: "Retry browser recovery",
  retry_draft_cleanup: "Retry draft cleanup",
  retry_draft_persistence: "Retry draft persistence",
} as const;
