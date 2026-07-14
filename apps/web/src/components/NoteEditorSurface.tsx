import type { ReactElement } from "react";
import { useSyncExternalStore } from "react";

import type {
  DraftRecoveryStatus,
  EditorSessionReader,
  NoteViewState,
} from "../state/note-browser-types.js";
import type { RouteHistoryStatus } from "../routing/route-transition-types.js";
import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { EditorSessionGate } from "./editor-session-gate.js";
import { MissingNoteDraftSurface } from "./MissingNoteDraftSurface.js";
import { SaveableNoteEditor } from "./SaveableNoteEditor.js";

type NoteEditorSurfaceProps = {
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly noteState: NoteViewState;
  readonly routeHistoryStatus: RouteHistoryStatus;
  readonly onDiscardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly onDiscardMissingDraft: () => Promise<void>;
  readonly onEditorModeChange: (editorMode: "markdown" | "wysiwyg") => void;
  readonly onPublishMarkdown: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly onRetryDraftPersistenceIssue: () => Promise<void>;
  readonly onSaveNote: () => Promise<void>;
  readonly readEditorSession: EditorSessionReader;
  readonly sessionGate: EditorSessionGate;
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
  onPublishMarkdown,
  onRetryDraftPersistenceIssue,
  onSaveNote,
  readEditorSession,
  routeHistoryStatus,
  sessionGate,
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
        onPublishMarkdown,
        onRetryDraftPersistenceIssue,
        onSaveNote,
        readEditorSession,
        routeHistoryStatus,
        sessionGate,
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
      <MissingNoteDraftSurface
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
  onPublishMarkdown,
  onRetryDraftPersistenceIssue,
  onSaveNote,
  readEditorSession,
  sessionGate,
}: NoteEditorSurfaceProps & {
  readonly editor: Extract<
    NoteViewState,
    { readonly status: "ready" }
  >["editor"];
}): ReactElement {
  const gateSnapshot = useSyncExternalStore(
    sessionGate.subscribe,
    sessionGate.getSnapshot,
    sessionGate.getSnapshot,
  );
  const isFrozen = gateSnapshot.frozenSessionKey === editor.sessionKey;
  return (
    <article
      aria-busy={isFrozen || undefined}
      className="mx-auto max-w-3xl"
      data-note-id={editor.note.id}
    >
      <EditorInteractionRegion
        editor={editor}
        inert={isFrozen}
        onDiscardDraftAndReloadDiskVersion={onDiscardDraftAndReloadDiskVersion}
        onEditorModeChange={onEditorModeChange}
        onPublishMarkdown={onPublishMarkdown}
        onRetryDraftPersistenceIssue={onRetryDraftPersistenceIssue}
        onSaveNote={onSaveNote}
        readEditorSession={readEditorSession}
        sessionGate={sessionGate}
      />
      <FrozenStatus isFrozen={isFrozen} message={gateSnapshot.message} />
    </article>
  );
}

function EditorInteractionRegion(
  props: Pick<
    NoteEditorSurfaceProps,
    | "onDiscardDraftAndReloadDiskVersion"
    | "onEditorModeChange"
    | "onPublishMarkdown"
    | "onRetryDraftPersistenceIssue"
    | "onSaveNote"
    | "readEditorSession"
    | "sessionGate"
  > & {
    readonly editor: Extract<NoteViewState, { status: "ready" }>["editor"];
    readonly inert: boolean;
  },
): ReactElement {
  return (
    <div
      data-testid="editor-interaction-region"
      inert={props.inert || undefined}
    >
      <header className="mb-6 border-b border-[var(--azurite-border)] pb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
          {props.editor.note.relativePath}
        </p>
        <h2 className="text-3xl font-semibold tracking-normal text-[var(--azurite-heading)]">
          {props.editor.note.title}
        </h2>
      </header>
      <SaveableNoteEditor
        editor={props.editor}
        onDiscardDraftAndReloadDiskVersion={
          props.onDiscardDraftAndReloadDiskVersion
        }
        onEditorModeChange={props.onEditorModeChange}
        onPublishMarkdown={props.onPublishMarkdown}
        onRetryDraftPersistenceIssue={props.onRetryDraftPersistenceIssue}
        onSaveNote={props.onSaveNote}
        readEditorSession={props.readEditorSession}
        sessionGate={props.sessionGate}
      />
    </div>
  );
}

function FrozenStatus(props: {
  readonly isFrozen: boolean;
  readonly message: string | undefined;
}): ReactElement | null {
  return props.isFrozen ? (
    <p className="mt-4 text-sm text-[var(--azurite-muted)]" role="status">
      {props.message}
    </p>
  ) : null;
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
