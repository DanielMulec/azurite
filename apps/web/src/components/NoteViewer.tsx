import type { NoteContent } from "@azurite/shared";
import type { ReactElement } from "react";

import { SanitizedMarkdown } from "./SanitizedMarkdown.js";

type LoadableNote =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: NoteContent };

type NoteViewerProps = {
  readonly noteState: LoadableNote;
};
type NonReadyNote = Exclude<LoadableNote, { readonly status: "ready" }>;

/** Main read-only surface for the selected markdown note. */
export function NoteViewer({ noteState }: NoteViewerProps): ReactElement {
  return (
    <section className="min-h-[32rem] rounded-lg border border-[var(--azurite-border)] bg-[var(--azurite-reading-surface)] p-5 shadow-sm md:min-h-[calc(100vh-7rem)] md:p-8">
      {renderNoteState(noteState)}
    </section>
  );
}

function renderNoteState(noteState: LoadableNote): ReactElement {
  if (noteState.status === "ready") {
    return <SelectedNote note={noteState.data} />;
  }

  return <NonReadyNoteMessage noteState={noteState} />;
}

function SelectedNote({ note }: { readonly note: NoteContent }): ReactElement {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-[var(--azurite-border)] pb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
          {note.relativePath}
        </p>
        <h2 className="text-3xl font-semibold tracking-normal text-[var(--azurite-heading)]">
          {note.title}
        </h2>
      </header>
      <SanitizedMarkdown markdown={note.markdown} />
    </article>
  );
}

function ViewerMessage({
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
      <ViewerMessage title="Unable to load note" text={noteState.message} />
    );
  }

  return <ViewerMessage {...nonReadyNoteContent[noteState.status]} />;
}

const nonReadyNoteContent = {
  idle: {
    text: "Choose a note from the workspace list.",
    title: "No note selected",
  },
  loading: {
    text: "Reading markdown...",
    title: "Loading note",
  },
} as const;
