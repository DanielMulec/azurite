import type {
  ListNotesResponse,
  NoteContent,
  NoteSummary,
  ReadNoteResponse,
} from "@azurite/shared";
import { useEffect, useState } from "react";

import { listNotes, readNote, WebApiError } from "./api-client.js";

type Loadable<T> =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T };

type NoteBrowserApi = {
  readonly listNotes: () => Promise<ListNotesResponse>;
  readonly readNote: (noteId: string) => Promise<ReadNoteResponse>;
};
type LoadNotesActions = {
  readonly setNotesState: (state: Loadable<readonly NoteSummary[]>) => void;
  readonly setSelectedNoteId: (
    selectNote: (current: string | undefined) => string | undefined,
  ) => void;
};

const defaultNoteBrowserApi: NoteBrowserApi = {
  listNotes,
  readNote,
};

/** State and actions for the read-only note browsing screen. */
export type NoteBrowserState = {
  readonly noteState: Loadable<NoteContent>;
  readonly notesState: Loadable<readonly NoteSummary[]>;
  readonly selectedNoteId: string | undefined;
  readonly selectNote: (noteId: string) => void;
};

/** Loads notes and selected-note content for the read-only browser UI. */
export function useNoteBrowser(
  api: NoteBrowserApi = defaultNoteBrowserApi,
): NoteBrowserState {
  const [notesState, setNotesState] = useState<
    Loadable<readonly NoteSummary[]>
  >({ status: "loading" });
  const [noteState, setNoteState] = useState<Loadable<NoteContent>>({
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
  setNoteState: (state: Loadable<NoteContent>) => void,
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
  setNoteState: (state: Loadable<NoteContent>) => void,
): () => void {
  let isActive = true;
  setNoteState({ status: "loading" });

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
  setNoteState: (state: Loadable<NoteContent>) => void,
): void {
  if (!isActive) {
    return;
  }

  setNoteState({ data: response.note, status: "ready" });
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
