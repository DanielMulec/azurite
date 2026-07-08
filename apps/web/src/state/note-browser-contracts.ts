import type {
  ListNotesResponse,
  ReadNoteResponse,
  SaveNoteInput,
  SaveNoteResponse,
} from "@azurite/shared";
import type { StoreApi } from "zustand/vanilla";

import type { DraftPersistence } from "../persistence/draft-database.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { NoteBrowserSnapshot } from "./note-browser-types.js";

/** Server API boundary used by the note browser store actions. */
export type NoteBrowserApi = {
  readonly listNotes: () => Promise<ListNotesResponse>;
  readonly readNote: (noteId: string) => Promise<ReadNoteResponse>;
  readonly saveNote: (input: SaveNoteInput) => Promise<SaveNoteResponse>;
};

/** Router adapter used by store actions without importing router internals. */
export type RouteNavigation = {
  readonly replaceSelectedNote: (noteId: string) => void;
};

/** Zustand store shape for note navigation, editing, saving, and recovery. */
export type NoteBrowserStore = NoteBrowserSnapshot & {
  readonly discardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly discardMissingDraft: () => Promise<void>;
  readonly flushPendingDraft: () => Promise<void>;
  readonly loadNotes: (
    routeNoteId: string | undefined,
    navigation: RouteNavigation,
  ) => Promise<void>;
  readonly saveSelectedNote: () => Promise<void>;
  readonly selectNote: (noteId: string) => Promise<void>;
  readonly syncRouteNote: (
    routeNoteId: string | undefined,
    navigation: RouteNavigation,
  ) => Promise<void>;
  readonly updateDraftMarkdown: (markdown: string) => void;
  readonly updateEditorMode: (editorMode: EditorMode) => void;
};

/** Mutable action context shared by focused store action modules. */
export type StoreContext = {
  readonly api: NoteBrowserApi;
  readonly draftPersistence: DraftPersistence;
  readonly get: () => NoteBrowserStore;
  readonly getLatestRouteNoteId: () => string | undefined;
  readonly isCurrentNoteRequest: (requestId: number, noteId: string) => boolean;
  readonly isCurrentNotesRequest: (requestId: number) => boolean;
  readonly nextEditorSessionKey: (
    noteId: string,
    contentHash: string,
  ) => string;
  readonly nextNoteRequestId: () => number;
  readonly nextNotesRequestId: () => number;
  readonly set: StoreApi<NoteBrowserStore>["setState"];
};
