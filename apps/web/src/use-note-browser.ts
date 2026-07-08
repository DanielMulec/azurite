import type {
  ListNotesResponse,
  NoteContentWithHash,
  NoteSummary,
  ReadNoteResponse,
  SaveNoteInput,
  SaveNoteResponse,
} from "@azurite/shared";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import {
  listNotes,
  readNote,
  saveNote as saveNoteRequest,
  WebApiError,
} from "./api-client.js";

type Loadable<T> =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T };

type NoteBrowserApi = {
  readonly listNotes: () => Promise<ListNotesResponse>;
  readonly readNote: (noteId: string) => Promise<ReadNoteResponse>;
  readonly saveNote: (input: SaveNoteInput) => Promise<SaveNoteResponse>;
};
type LoadNotesActions = {
  readonly setNotesState: (state: Loadable<readonly NoteSummary[]>) => void;
  readonly setSelectedNoteId: (
    selectNote: (current: string | undefined) => string | undefined,
  ) => void;
};
type NoteStateSetter = Dispatch<SetStateAction<Loadable<NoteContentWithHash>>>;
type NotesStateSetter = Dispatch<
  SetStateAction<Loadable<readonly NoteSummary[]>>
>;
type SaveSelectedNoteActions = {
  readonly setNoteState: NoteStateSetter;
  readonly setNotesState: NotesStateSetter;
};

const defaultNoteBrowserApi: NoteBrowserApi = {
  listNotes,
  readNote,
  saveNote: saveNoteRequest,
};

/** State and actions for the editable note browsing screen. */
export type NoteBrowserState = {
  readonly noteState: Loadable<NoteContentWithHash>;
  readonly notesState: Loadable<readonly NoteSummary[]>;
  readonly saveNote: (input: SaveNoteInput) => Promise<NoteContentWithHash>;
  readonly selectedNoteId: string | undefined;
  readonly selectNote: (noteId: string) => void;
};

/** Loads notes and selected-note content for the browser UI. */
export function useNoteBrowser(
  api: NoteBrowserApi = defaultNoteBrowserApi,
): NoteBrowserState {
  const [notesState, setNotesState] = useState<
    Loadable<readonly NoteSummary[]>
  >({ status: "loading" });
  const [noteState, setNoteState] = useState<Loadable<NoteContentWithHash>>({
    status: "idle",
  });
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();

  useEffect(() => loadNotes(api, setNotesState, setSelectedNoteId), [api]);
  useEffect(
    () => loadSelectedNote(api, selectedNoteId, setNoteState),
    [api, selectedNoteId],
  );

  return {
    noteState,
    notesState,
    saveNote: (input) =>
      saveSelectedNote(api, input, {
        setNoteState,
        setNotesState,
      }),
    selectNote: setSelectedNoteId,
    selectedNoteId,
  };
}

function loadNotes(
  api: NoteBrowserApi,
  setNotesState: (state: Loadable<readonly NoteSummary[]>) => void,
  setSelectedNoteId: (
    selectNote: (current: string | undefined) => string | undefined,
  ) => void,
): () => void {
  let isActive = true;
  setNotesState({ status: "loading" });

  void api.listNotes().then(
    (response) => {
      handleLoadedNotes(response, isActive, {
        setNotesState,
        setSelectedNoteId,
      });
    },
    (error: unknown) => {
      handleLoadError(error, isActive, setNotesState);
    },
  );

  return () => {
    isActive = false;
  };
}

function loadSelectedNote(
  api: NoteBrowserApi,
  selectedNoteId: string | undefined,
  setNoteState: NoteStateSetter,
): () => void {
  if (selectedNoteId === undefined) {
    setNoteState({ status: "idle" });
    return noop;
  }

  return requestSelectedNote(api, selectedNoteId, setNoteState);
}

function requestSelectedNote(
  api: NoteBrowserApi,
  selectedNoteId: string,
  setNoteState: NoteStateSetter,
): () => void {
  let isActive = true;
  keepRenderedNoteWhileLoading(setNoteState);

  void api.readNote(selectedNoteId).then(
    (response) => {
      handleLoadedNote(response, isActive, setNoteState);
    },
    (error: unknown) => {
      handleLoadError(error, isActive, setNoteState);
    },
  );

  return () => {
    isActive = false;
  };
}

function handleLoadedNotes(
  response: ListNotesResponse,
  isActive: boolean,
  actions: LoadNotesActions,
): void {
  if (!isActive) {
    return;
  }

  actions.setNotesState({ data: response.notes, status: "ready" });
  actions.setSelectedNoteId(
    (currentNoteId) => currentNoteId ?? response.notes[0]?.id,
  );
}

function handleLoadedNote(
  response: ReadNoteResponse,
  isActive: boolean,
  setNoteState: NoteStateSetter,
): void {
  if (!isActive) {
    return;
  }

  setNoteState({ data: response.note, status: "ready" });
}

async function saveSelectedNote(
  api: NoteBrowserApi,
  input: SaveNoteInput,
  actions: SaveSelectedNoteActions,
): Promise<NoteContentWithHash> {
  const response = await api.saveNote(input);
  updateSavedNote(response.note, actions.setNoteState, actions.setNotesState);
  return response.note;
}

function updateSavedNote(
  note: NoteContentWithHash,
  setNoteState: NoteStateSetter,
  setNotesState: NotesStateSetter,
): void {
  setNoteState({ data: note, status: "ready" });
  setNotesState((currentNotesState) =>
    patchSavedNoteSummary(currentNotesState, note),
  );
}

function patchSavedNoteSummary(
  notesState: Loadable<readonly NoteSummary[]>,
  note: NoteContentWithHash,
): Loadable<readonly NoteSummary[]> {
  if (notesState.status !== "ready") {
    return notesState;
  }

  return {
    data: notesState.data.map((summary) =>
      summary.id === note.id ? toNoteSummary(note) : summary,
    ),
    status: "ready",
  };
}

function toNoteSummary(note: NoteContentWithHash): NoteSummary {
  return {
    fileName: note.fileName,
    id: note.id,
    lastModifiedAt: note.lastModifiedAt,
    relativePath: note.relativePath,
    sizeBytes: note.sizeBytes,
    title: note.title,
  };
}

function keepRenderedNoteWhileLoading(setNoteState: NoteStateSetter): void {
  setNoteState((currentNoteState) => {
    if (currentNoteState.status === "ready") {
      return currentNoteState;
    }

    return { status: "loading" };
  });
}

function handleLoadError<T>(
  error: unknown,
  isActive: boolean,
  setState: (state: Loadable<T>) => void,
): void {
  if (!isActive) {
    return;
  }

  setState({ message: getSafeErrorMessage(error), status: "error" });
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof WebApiError) {
    return error.message;
  }

  return "Something went wrong while loading notes.";
}

function noop(): void {}
