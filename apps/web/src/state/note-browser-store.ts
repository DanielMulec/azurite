import { createStore, type StoreApi } from "zustand/vanilla";

import {
  listNotes,
  readNote,
  saveNote as saveNoteRequest,
} from "../api-client.js";
import {
  createDraftPersistence,
  type DraftPersistence,
} from "../persistence/draft-database.js";
import type { EditorMode } from "../persistence/draft-records.js";
import {
  discardDraftAndReloadDiskVersionAction,
  discardMissingDraftAction,
  loadNotesAction,
  persistCurrentDraft,
  saveSelectedNoteAction,
  selectNoteAction,
  syncRouteNoteAction,
  updateCurrentEditor,
} from "./note-browser-actions.js";
import type {
  NoteBrowserApi,
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";

type NoteBrowserStoreOptions = {
  readonly api?: NoteBrowserApi;
  readonly draftPersistence?: DraftPersistence;
  readonly draftWriteDelayMs?: number;
};

type NoteBrowserRuntime = {
  readonly api: NoteBrowserApi;
  readonly context: StoreContext;
  readonly draftPersistence: DraftPersistence;
  readonly draftWriteDelayMs: number;
  editorSessionVersion: number;
  hasPendingDraftWrite: boolean;
  noteRequestId: number;
  notesRequestId: number;
  pendingDraftTimer: ReturnType<typeof setTimeout> | undefined;
};

const defaultApi: NoteBrowserApi = {
  listNotes,
  readNote,
  saveNote: saveNoteRequest,
};

/** Creates the state boundary for note navigation, recovery, and saving. */
export function createNoteBrowserStore(
  options: NoteBrowserStoreOptions = {},
): StoreApi<NoteBrowserStore> {
  const runtime = createRuntime(options);

  return createStore<NoteBrowserStore>((set, get) =>
    createInitialState(runtime, set, get),
  );
}

export type { NoteBrowserStore } from "./note-browser-contracts.js";

function createRuntime(options: NoteBrowserStoreOptions): NoteBrowserRuntime {
  return {
    api: getApi(options),
    context: {} as StoreContext,
    draftPersistence: getDraftPersistence(options),
    draftWriteDelayMs: getDraftWriteDelayMs(options),
    editorSessionVersion: 0,
    hasPendingDraftWrite: false,
    noteRequestId: 0,
    notesRequestId: 0,
    pendingDraftTimer: undefined,
  };
}

function createInitialState(
  runtime: NoteBrowserRuntime,
  set: StoreContext["set"],
  get: StoreContext["get"],
): NoteBrowserStore {
  configureContext(runtime, set, get);

  return {
    clusterIdentity: undefined,
    discardDraftAndReloadDiskVersion: () =>
      discardDraftAndReloadDiskVersionAction(runtime.context),
    discardMissingDraft: () => discardMissingDraftAction(runtime.context),
    draftRecoveryStatus: { status: "available" },
    flushPendingDraft: () => flushPendingDraft(runtime),
    loadNotes: (routeNoteId, navigation) =>
      loadNotesAction(routeNoteId, navigation, runtime.context),
    noteState: { status: "idle" },
    notesState: { status: "idle" },
    saveSelectedNote: () => saveSelectedNoteAction(runtime.context),
    selectNote: (noteId) => selectNote(noteId, runtime),
    selectedNoteId: undefined,
    syncRouteNote: (routeNoteId, navigation) =>
      flushThenSyncRouteNote(routeNoteId, navigation, runtime),
    updateDraftMarkdown: (markdown) => {
      updateDraftMarkdown(markdown, runtime);
    },
    updateEditorMode: (editorMode) => {
      updateEditorMode(editorMode, runtime);
    },
  };
}

function getApi(options: NoteBrowserStoreOptions): NoteBrowserApi {
  return options.api ?? defaultApi;
}

function getDraftPersistence(
  options: NoteBrowserStoreOptions,
): DraftPersistence {
  return options.draftPersistence ?? createDraftPersistence();
}

function getDraftWriteDelayMs(options: NoteBrowserStoreOptions): number {
  return options.draftWriteDelayMs ?? 250;
}

function configureContext(
  runtime: NoteBrowserRuntime,
  set: StoreContext["set"],
  get: StoreContext["get"],
): void {
  Object.assign(runtime.context, {
    api: runtime.api,
    draftPersistence: runtime.draftPersistence,
    get,
    isCurrentNoteRequest: (requestId: number, noteId: string) =>
      requestId === runtime.noteRequestId && get().selectedNoteId === noteId,
    isCurrentNotesRequest: (requestId: number) =>
      requestId === runtime.notesRequestId,
    nextEditorSessionKey: (noteId: string, contentHash: string) =>
      nextEditorSessionKey(noteId, contentHash, runtime),
    nextNoteRequestId: () => incrementNoteRequest(runtime),
    nextNotesRequestId: () => incrementNotesRequest(runtime),
    set,
  } satisfies StoreContext);
}

async function flushPendingDraft(runtime: NoteBrowserRuntime): Promise<void> {
  clearPendingDraftTimer(runtime);

  if (!runtime.hasPendingDraftWrite) {
    return;
  }

  runtime.hasPendingDraftWrite = false;
  await persistCurrentDraft(runtime.context);
}

function scheduleDraftWrite(runtime: NoteBrowserRuntime): void {
  runtime.hasPendingDraftWrite = true;
  clearPendingDraftTimer(runtime);
  runtime.pendingDraftTimer = setTimeout(() => {
    void flushPendingDraft(runtime);
  }, runtime.draftWriteDelayMs);
}

async function selectNote(
  noteId: string,
  runtime: NoteBrowserRuntime,
): Promise<void> {
  await flushPendingDraft(runtime);
  await selectNoteAction(noteId, runtime.context);
}

async function flushThenSyncRouteNote(
  routeNoteId: string | undefined,
  navigation: Parameters<NoteBrowserStore["syncRouteNote"]>[1],
  runtime: NoteBrowserRuntime,
): Promise<void> {
  await flushPendingDraft(runtime);
  await syncRouteNoteAction(routeNoteId, navigation, runtime.context);
}

function updateDraftMarkdown(
  markdown: string,
  runtime: NoteBrowserRuntime,
): void {
  updateCurrentEditor({ currentMarkdown: markdown }, runtime.context);
  scheduleDraftWrite(runtime);
}

function updateEditorMode(
  editorMode: EditorMode,
  runtime: NoteBrowserRuntime,
): void {
  updateCurrentEditor({ editorMode }, runtime.context);
  scheduleDraftWrite(runtime);
}

function clearPendingDraftTimer(runtime: NoteBrowserRuntime): void {
  if (runtime.pendingDraftTimer !== undefined) {
    clearTimeout(runtime.pendingDraftTimer);
    runtime.pendingDraftTimer = undefined;
  }
}

function nextEditorSessionKey(
  noteId: string,
  contentHash: string,
  runtime: NoteBrowserRuntime,
): string {
  runtime.editorSessionVersion += 1;
  return `${noteId}:${contentHash}:${String(runtime.editorSessionVersion)}`;
}

function incrementNoteRequest(runtime: NoteBrowserRuntime): number {
  runtime.noteRequestId += 1;
  return runtime.noteRequestId;
}

function incrementNotesRequest(runtime: NoteBrowserRuntime): number {
  runtime.notesRequestId += 1;
  return runtime.notesRequestId;
}
