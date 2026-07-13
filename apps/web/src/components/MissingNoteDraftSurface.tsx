import type { ReactElement } from "react";
import { useState } from "react";

import type { NoteViewState } from "../state/note-browser-types.js";

type MissingNoteDraftState = Extract<
  NoteViewState,
  { readonly status: "missing-draft" }
>;

type MissingNoteDraftSurfaceProps = {
  readonly noteState: MissingNoteDraftState;
  readonly onDiscardMissingDraft: () => Promise<unknown>;
};

/** Recovery surface for a browser draft whose note is absent from disk. */
export function MissingNoteDraftSurface({
  noteState,
  onDiscardMissingDraft,
}: MissingNoteDraftSurfaceProps): ReactElement {
  const [isDiscarding, setIsDiscarding] = useState(false);
  const discard = (): void => {
    setIsDiscarding(true);
    void onDiscardMissingDraft().finally(() => {
      setIsDiscarding(false);
    });
  };
  return (
    <article
      aria-busy={isDiscarding || undefined}
      className="mx-auto max-w-3xl"
      data-note-id={noteState.noteId}
    >
      <div inert={toInertValue(isDiscarding)}>
        <MissingDraftHeader noteState={noteState} />
        <MissingDraftActions noteState={noteState} onDiscard={discard} />
        <MissingDraftSource markdown={noteState.draft.markdown} />
      </div>
      <DiscardingStatus isDiscarding={isDiscarding} />
    </article>
  );
}

function MissingDraftHeader({
  noteState,
}: {
  readonly noteState: MissingNoteDraftState;
}): ReactElement {
  const isUnknown = noteState.draftDisposition === "preserved_unknown";
  return (
    <header className="mb-6 border-b border-[var(--azurite-border)] pb-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
        {noteState.noteId}
      </p>
      <h2 className="text-3xl font-semibold tracking-normal text-[var(--azurite-heading)]">
        {isUnknown
          ? "Newer recovery record for missing note"
          : "Recovered draft for missing note"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--azurite-muted)]">
        {isUnknown
          ? "A newer Azurite build now owns this browser recovery record. Use a compatible build to inspect or dispose of it."
          : "The file is no longer present on disk, but Azurite recovered the browser draft. Save is disabled until note restore or creation exists."}
      </p>
    </header>
  );
}

function MissingDraftActions(props: {
  readonly noteState: MissingNoteDraftState;
  readonly onDiscard: () => void;
}): ReactElement {
  return (
    <div className="mb-4 flex justify-end border-b border-[var(--azurite-border)] pb-4">
      <MissingDiscardButton {...props} />
    </div>
  );
}

function MissingDiscardButton(props: {
  readonly noteState: MissingNoteDraftState;
  readonly onDiscard: () => void;
}): ReactElement | null {
  if (props.noteState.draftDisposition !== "recovered") {
    return null;
  }
  return (
    <button
      className="w-fit border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
      onClick={() => {
        runConfirmedMissingDiscard(props);
      }}
      type="button"
    >
      {getMissingDiscardLabel(props.noteState)}
    </button>
  );
}

function runConfirmedMissingDiscard(props: {
  readonly noteState: MissingNoteDraftState;
  readonly onDiscard: () => void;
}): void {
  if (confirmMissingDraftDiscard(props.noteState.draft.markdown)) {
    props.onDiscard();
  }
}

function getMissingDiscardLabel(state: MissingNoteDraftState): string {
  return state.persistenceIssue?.retryAction === "retry_discard"
    ? "Retry discard"
    : "Discard recovered draft";
}

function DiscardingStatus(props: {
  readonly isDiscarding: boolean;
}): ReactElement | null {
  return props.isDiscarding ? (
    <p role="status">Discarding browser draft...</p>
  ) : null;
}

function MissingDraftSource(props: {
  readonly markdown: string;
}): ReactElement {
  return (
    <textarea
      className="min-h-[28rem] w-full resize-y border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-4 py-3 font-mono text-sm leading-6 text-[var(--azurite-text)]"
      readOnly
      spellCheck={false}
      value={props.markdown}
    />
  );
}

function confirmMissingDraftDiscard(markdown: string): boolean {
  return (
    markdown.length === 0 || window.confirm("Discard this recovered draft?")
  );
}

function toInertValue(active: boolean): true | undefined {
  return active ? true : undefined;
}
