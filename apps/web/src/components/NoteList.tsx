import type { NoteSummary } from "@azurite/shared";
import type { ReactElement } from "react";

type LoadableNotes =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: readonly NoteSummary[] };

type NoteListProps = {
  readonly notesState: LoadableNotes;
  readonly onSelectNote: (noteId: string) => void;
  readonly selectedNoteId: string | undefined;
};
type NonReadyNotes = Exclude<LoadableNotes, { readonly status: "ready" }>;

/** Sidebar list for selecting markdown notes in the current cluster. */
export function NoteList({
  notesState,
  onSelectNote,
  selectedNoteId,
}: NoteListProps): ReactElement {
  return (
    <aside className="rounded-lg border border-[var(--azurite-border)] bg-[var(--azurite-surface)] p-3 shadow-sm md:min-h-[calc(100vh-7rem)]">
      <h2 className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
        Notes
      </h2>
      {renderNotesState(notesState, onSelectNote, selectedNoteId)}
    </aside>
  );
}

function renderNotesState(
  notesState: LoadableNotes,
  onSelectNote: (noteId: string) => void,
  selectedNoteId: string | undefined,
): ReactElement {
  if (notesState.status !== "ready") {
    return <NonReadyNotesMessage notesState={notesState} />;
  }

  if (notesState.data.length === 0) {
    return <ListMessage text="No markdown notes found in this cluster." />;
  }

  return (
    <ul className="mt-3 flex flex-col gap-1">
      {notesState.data.map((note) => (
        <NoteListItem
          isSelected={note.id === selectedNoteId}
          key={note.id}
          note={note}
          onSelectNote={onSelectNote}
        />
      ))}
    </ul>
  );
}

function NonReadyNotesMessage({
  notesState,
}: {
  readonly notesState: NonReadyNotes;
}): ReactElement {
  if (notesState.status === "error") {
    return <ListMessage text={notesState.message} />;
  }

  return <ListMessage text={nonReadyNotesText[notesState.status]} />;
}

const nonReadyNotesText = {
  idle: "No markdown notes found in this cluster.",
  loading: "Loading cluster notes...",
} as const;

function NoteListItem({
  isSelected,
  note,
  onSelectNote,
}: {
  readonly isSelected: boolean;
  readonly note: NoteSummary;
  readonly onSelectNote: (noteId: string) => void;
}): ReactElement {
  return (
    <li>
      <button
        aria-current={isSelected ? "page" : undefined}
        className={createNoteButtonClassName(isSelected)}
        data-note-id={note.id}
        data-testid="note-list-item"
        onClick={() => {
          onSelectNote(note.id);
        }}
        type="button"
      >
        <span className="truncate text-sm font-medium">{note.title}</span>
        <span className="truncate text-xs text-[var(--azurite-muted)]">
          {note.relativePath}
        </span>
      </button>
    </li>
  );
}

function createNoteButtonClassName(isSelected: boolean): string {
  const baseClassName =
    "flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--azurite-accent)]";

  if (isSelected) {
    return `${baseClassName} bg-[var(--azurite-selected)] text-[var(--azurite-selected-text)]`;
  }

  return `${baseClassName} hover:bg-[var(--azurite-hover)]`;
}

function ListMessage({ text }: { readonly text: string }): ReactElement {
  return (
    <p className="mt-3 rounded-md border border-dashed border-[var(--azurite-border)] px-3 py-4 text-sm text-[var(--azurite-muted)]">
      {text}
    </p>
  );
}
