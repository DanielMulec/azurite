import type { ReactElement } from "react";

import type {
  DraftRecoveryStatus,
  NoteViewState,
} from "../state/note-browser-types.js";
import type { RouteHistoryStatus } from "../routing/route-transition-types.js";
import { SaveableNoteEditor } from "./SaveableNoteEditor.js";

type NoteEditorSurfaceProps = {
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly noteState: NoteViewState;
  readonly routeHistoryStatus: RouteHistoryStatus;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly onDiscardMissingDraft: () => Promise<void>;
  readonly onEditorModeChange: (editorMode: "markdown" | "wysiwyg") => void;
  readonly onMarkdownChange: (markdown: string) => void;
  readonly onSaveNote: () => Promise<void>;
};
type NonReadyNote = Exclude<
  NoteViewState,
  { readonly status: "missing-draft" } | { readonly status: "ready" }
>;

/** Main editable surface for the selected markdown note. */
export function NoteEditorSurface({
  draftRecoveryStatus,
  noteState,
  onDiscardDraftAndReloadDiskVersion,
  onDiscardMissingDraft,
  onEditorModeChange,
  onMarkdownChange,
  onSaveNote,
  routeHistoryStatus,
}: NoteEditorSurfaceProps): ReactElement {
  return (
    <section className="min-h-[32rem] border border-[var(--azurite-border)] bg-[var(--azurite-reading-surface)] p-5 shadow-sm md:min-h-[calc(100vh-7rem)] md:p-8">
      <DraftRecoveryBanner draftRecoveryStatus={draftRecoveryStatus} />
      <RouteHistoryBanner routeHistoryStatus={routeHistoryStatus} />
      {renderNoteState({
        draftRecoveryStatus,
        noteState,
        onDiscardDraftAndReloadDiskVersion,
        onDiscardMissingDraft,
        onEditorModeChange,
        onMarkdownChange,
        onSaveNote,
        routeHistoryStatus,
      })}
    </section>
  );
}

function renderNoteState(props: NoteEditorSurfaceProps): ReactElement {
  if (props.noteState.status === "ready") {
    return <SelectedNote {...props} editor={props.noteState.editor} />;
  }

  if (props.noteState.status === "missing-draft") {
    return (
      <MissingNoteDraft
        noteState={props.noteState}
        onDiscardMissingDraft={props.onDiscardMissingDraft}
      />
    );
  }

  return <NonReadyNoteMessage noteState={props.noteState} />;
}

function SelectedNote({
  editor,
  onDiscardDraftAndReloadDiskVersion,
  onEditorModeChange,
  onMarkdownChange,
  onSaveNote,
}: NoteEditorSurfaceProps & {
  readonly editor: Extract<
    NoteViewState,
    { readonly status: "ready" }
  >["editor"];
}): ReactElement {
  return (
    <article className="mx-auto max-w-3xl" data-note-id={editor.note.id}>
      <header className="mb-6 border-b border-[var(--azurite-border)] pb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
          {editor.note.relativePath}
        </p>
        <h2 className="text-3xl font-semibold tracking-normal text-[var(--azurite-heading)]">
          {editor.note.title}
        </h2>
      </header>
      <SaveableNoteEditor
        editor={editor}
        onDiscardDraftAndReloadDiskVersion={onDiscardDraftAndReloadDiskVersion}
        onEditorModeChange={onEditorModeChange}
        onMarkdownChange={onMarkdownChange}
        onSaveNote={onSaveNote}
      />
    </article>
  );
}

function RouteHistoryBanner({
  routeHistoryStatus,
}: {
  readonly routeHistoryStatus: RouteHistoryStatus;
}): ReactElement | null {
  if (routeHistoryStatus.status !== "degraded") {
    return null;
  }
  return (
    <p className="mx-auto mb-4 max-w-3xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {routeHistoryStatus.message}
    </p>
  );
}

function DraftRecoveryBanner({
  draftRecoveryStatus,
}: {
  readonly draftRecoveryStatus: DraftRecoveryStatus;
}): ReactElement | null {
  if (draftRecoveryStatus.status !== "degraded") {
    return null;
  }

  return (
    <p className="mx-auto mb-4 max-w-3xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {draftRecoveryStatus.message}
    </p>
  );
}

function MissingNoteDraft({
  noteState,
  onDiscardMissingDraft,
}: {
  readonly noteState: Extract<
    NoteViewState,
    { readonly status: "missing-draft" }
  >;
  readonly onDiscardMissingDraft: () => Promise<void>;
}): ReactElement {
  return (
    <article className="mx-auto max-w-3xl" data-note-id={noteState.noteId}>
      <header className="mb-6 border-b border-[var(--azurite-border)] pb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
          {noteState.noteId}
        </p>
        <h2 className="text-3xl font-semibold tracking-normal text-[var(--azurite-heading)]">
          Recovered draft for missing note
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--azurite-muted)]">
          The file is no longer present on disk, but Azurite recovered the
          browser draft. Save is disabled until note restore or creation exists.
        </p>
      </header>
      <div className="mb-4 flex justify-end border-b border-[var(--azurite-border)] pb-4">
        <button
          className="w-fit border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          onClick={() => {
            if (confirmMissingDraftDiscard(noteState.draft.markdown)) {
              void onDiscardMissingDraft();
            }
          }}
          type="button"
        >
          Discard recovered draft
        </button>
      </div>
      <textarea
        className="min-h-[28rem] w-full resize-y border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-4 py-3 font-mono text-sm leading-6 text-[var(--azurite-text)]"
        readOnly
        spellCheck={false}
        value={noteState.draft.markdown}
      />
    </article>
  );
}

function SurfaceMessage({
  text,
  title,
}: {
  readonly text: string;
  readonly title: string;
}): ReactElement {
  return (
    <div className="flex min-h-80 items-center justify-center">
      <div className="max-w-sm text-center">
        <h2 className="text-xl font-semibold text-[var(--azurite-heading)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--azurite-muted)]">
          {text}
        </p>
      </div>
    </div>
  );
}

function NonReadyNoteMessage({
  noteState,
}: {
  readonly noteState: NonReadyNote;
}): ReactElement {
  if (noteState.status === "error") {
    return (
      <SurfaceMessage title="Unable to load note" text={noteState.message} />
    );
  }

  if (noteState.status === "missing") {
    return (
      <SurfaceMessage
        title="Note not found"
        text="The selected note no longer exists on disk."
      />
    );
  }

  return <SurfaceMessage {...nonReadyNoteContent[noteState.status]} />;
}

function confirmMissingDraftDiscard(markdown: string): boolean {
  if (markdown.length === 0) {
    return true;
  }

  return window.confirm("Discard this recovered draft?");
}

const nonReadyNoteContent = {
  idle: {
    text: "Choose a note from the cluster list.",
    title: "No note selected",
  },
  loading: {
    text: "Reading markdown...",
    title: "Loading note",
  },
} as const;
