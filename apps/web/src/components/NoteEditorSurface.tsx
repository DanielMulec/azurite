import type { NoteContent } from "@azurite/shared";
import type { ReactElement } from "react";

import { MilkdownEditor } from "./MilkdownEditor.js";

type LoadableNote =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: NoteContent };

type NoteEditorSurfaceProps = {
  readonly noteState: LoadableNote;
};
type NonReadyNote = Exclude<LoadableNote, { readonly status: "ready" }>;

/** Main editable surface for the selected markdown note. */
export function NoteEditorSurface({
  noteState,
}: NoteEditorSurfaceProps): ReactElement {
  return (
    <section className="min-h-[32rem] border border-[var(--azurite-border)] bg-[var(--azurite-reading-surface)] p-5 shadow-sm md:min-h-[calc(100vh-7rem)] md:p-8">
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
      <header className="mb-6 border-b border-[var(--azurite-border)] pb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
          {note.relativePath}
        </p>
        <h2 className="text-3xl font-semibold tracking-normal text-[var(--azurite-heading)]">
          {note.title}
        </h2>
      </header>
      <MilkdownEditor
        initialMarkdown={note.markdown}
        noteId={note.id}
        title={note.title}
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
