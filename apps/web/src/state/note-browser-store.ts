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
  ActiveNoteLoad,
  ActiveNoteSave,
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
  activeNoteLoad: ActiveNoteLoad | undefined;
  readonly activeNoteSaves: Map<string, ActiveNoteSave>;
  readonly api: NoteBrowserApi;
  readonly context: StoreContext;
  readonly draftPersistence: DraftPersistence;
  readonly draftWriteDelayMs: number;
  editorSessionVersion: number;
  hasPendingDraftWrite: boolean;
  latestRouteNoteId: string | undefined;
  noteRequestSequence: number;
  notesRequestSequence: number;
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
    activeNoteLoad: undefined,
    activeNoteSaves: new Map(),
    api: getApi(options),
    context: {} as StoreContext,
    draftPersistence: getDraftPersistence(options),
    draftWriteDelayMs: getDraftWriteDelayMs(options),
    editorSessionVersion: 0,
    hasPendingDraftWrite: false,
    latestRouteNoteId: undefined,
    noteRequestSequence: 0,
    notesRequestSequence: 0,
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
      loadNotes(routeNoteId, navigation, runtime),
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
    clearActiveNoteLoad: (promise: Promise<void>) => {
      if (runtime.activeNoteLoad?.promise === promise) {
        runtime.activeNoteLoad = undefined;
      }
    },
    clearActiveNoteSave: (noteId: string, promise: Promise<void>) => {
      if (runtime.activeNoteSaves.get(noteId)?.promise === promise) {
        runtime.activeNoteSaves.delete(noteId);
      }
    },
    draftPersistence: runtime.draftPersistence,
    get,
    getActiveNoteLoad: (noteId: string) =>
      runtime.activeNoteLoad?.noteId === noteId
        ? runtime.activeNoteLoad
        : undefined,
    getActiveNoteSave: (noteId: string) => runtime.activeNoteSaves.get(noteId),
    getLatestRouteNoteId: () => runtime.latestRouteNoteId,
    isCurrentNoteRequest: (requestSequence: number, noteId: string) =>
      requestSequence === runtime.noteRequestSequence &&
      get().selectedNoteId === noteId,
    isCurrentNotesRequest: (requestSequence: number) =>
      requestSequence === runtime.notesRequestSequence,
    nextEditorSessionKey: (noteId: string, contentHash: string) =>
      nextEditorSessionKey(noteId, contentHash, runtime),
    nextNoteRequestSequence: () => incrementNoteRequestSequence(runtime),
    nextNotesRequestSequence: () => incrementNotesRequestSequence(runtime),
    set,
    setActiveNoteLoad: (load: ActiveNoteLoad) => {
      runtime.activeNoteLoad = load;
    },
    setActiveNoteSave: (noteId: string, save: ActiveNoteSave) => {
      runtime.activeNoteSaves.set(noteId, save);
    },
  } satisfies StoreContext);
}

async function loadNotes(
  routeNoteId: string | undefined,
  navigation: Parameters<NoteBrowserStore["loadNotes"]>[1],
  runtime: NoteBrowserRuntime,
): Promise<void> {
  setLatestRouteNoteId(routeNoteId, runtime);
  await loadNotesAction(navigation, runtime.context);
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
  setLatestRouteNoteId(routeNoteId, runtime);
  await flushPendingDraft(runtime);
  await syncRouteNoteAction(routeNoteId, navigation, runtime.context);
}

function setLatestRouteNoteId(
  routeNoteId: string | undefined,
  runtime: NoteBrowserRuntime,
): void {
  runtime.latestRouteNoteId = routeNoteId;
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

function incrementNoteRequestSequence(runtime: NoteBrowserRuntime): number {
  runtime.noteRequestSequence += 1;
  return runtime.noteRequestSequence;
}

function incrementNotesRequestSequence(runtime: NoteBrowserRuntime): number {
  runtime.notesRequestSequence += 1;
  return runtime.notesRequestSequence;
}
