import type {
  ApiRequestMetadata,
  ListNotesResponse,
  ReadNoteResponse,
  SaveNoteInput,
  SaveNoteResponse,
} from "@azurite/shared";
import type { StoreApi } from "zustand/vanilla";

import type { DraftPersistence } from "../persistence/draft-database.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { EditorSession } from "./note-browser-types.js";
import type { NoteBrowserSnapshot } from "./note-browser-types.js";

/** Ephemeral ownership for one in-flight note load. */
export type ActiveNoteLoad = {
  readonly metadata: ApiRequestMetadata;
  readonly noteId: string;
  readonly promise: Promise<void>;
  readonly requestSequence: number;
  readonly routeSource: string;
};

/** Ephemeral ownership for one in-flight manual save. */
export type ActiveNoteSave = {
  readonly editor: EditorSession;
  readonly metadata: ApiRequestMetadata;
  readonly promise: Promise<void>;
};

/** Server API boundary used by the note browser store actions. */
export type NoteBrowserApi = {
  readonly listNotes: (
    metadata: ApiRequestMetadata,
  ) => Promise<ListNotesResponse>;
  readonly readNote: (
    noteId: string,
    metadata: ApiRequestMetadata,
  ) => Promise<ReadNoteResponse>;
  readonly saveNote: (
    input: SaveNoteInput,
    metadata: ApiRequestMetadata,
  ) => Promise<SaveNoteResponse>;
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
  readonly clearActiveNoteLoad: (promise: Promise<void>) => void;
  readonly clearActiveNoteSave: (
    noteId: string,
    promise: Promise<void>,
  ) => void;
  readonly get: () => NoteBrowserStore;
  readonly getActiveNoteLoad: (noteId: string) => ActiveNoteLoad | undefined;
  readonly getActiveNoteSave: (noteId: string) => ActiveNoteSave | undefined;
  readonly getLatestRouteNoteId: () => string | undefined;
  readonly isCurrentNoteRequest: (
    requestSequence: number,
    noteId: string,
  ) => boolean;
  readonly isCurrentNotesRequest: (requestSequence: number) => boolean;
  readonly nextEditorSessionKey: (
    noteId: string,
    contentHash: string,
  ) => string;
  readonly nextNoteRequestSequence: () => number;
  readonly nextNotesRequestSequence: () => number;
  readonly set: StoreApi<NoteBrowserStore>["setState"];
  readonly setActiveNoteLoad: (load: ActiveNoteLoad) => void;
  readonly setActiveNoteSave: (noteId: string, save: ActiveNoteSave) => void;
};
