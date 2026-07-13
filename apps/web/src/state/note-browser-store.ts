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
import type { RouteStoreExecutor } from "../routing/route-store-executor.js";
import type { NoteLoadAuthorization } from "../routing/route-transition-types.js";
import {
  applyRouteAction,
  discardDraftAndReloadDiskVersionAction,
  discardMissingDraftAction,
  ensureNotesAction,
  persistCurrentDraft,
  saveSelectedNoteAction,
  updateCurrentEditor,
} from "./note-browser-actions.js";
import type {
  ActiveNoteLoad,
  ActiveNoteSave,
  ActiveNotesLoad,
  NoteBrowserApi,
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";
import {
  getCoherentRouteView,
  getRenderedOwnerKey,
} from "./note-browser-route-predicates.js";

type NoteBrowserStoreOptions = {
  readonly api?: NoteBrowserApi;
  readonly draftPersistence?: DraftPersistence;
  readonly draftWriteDelayMs?: number;
};

type NoteBrowserRuntime = {
  activeDraftFlush: Promise<void> | undefined;
  activeNoteLoad: ActiveNoteLoad | undefined;
  readonly activeNoteSaves: Map<string, ActiveNoteSave>;
  activeNotesLoad: ActiveNotesLoad | undefined;
  readonly api: NoteBrowserApi;
  readonly context: StoreContext;
  currentRouteIntentKey: string | undefined;
  readonly draftPersistence: DraftPersistence;
  readonly draftWriteDelayMs: number;
  editorSessionVersion: number;
  hasPendingDraftWrite: boolean;
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

/** Exposes one store instance through the route owner's narrow executor seam. */
export function createNoteBrowserRouteExecutor(
  store: StoreApi<NoteBrowserStore>,
): RouteStoreExecutor {
  const state = store.getState();
  return {
    activateRouteIntent: state.activateRouteIntent,
    applyRoute: state.applyRoute,
    ensureNotes: state.ensureNotes,
    getCoherentView: state.getCoherentView,
    getRenderedOwnerKey: state.getRenderedOwnerKey,
    reportHistoryUnavailable: state.reportHistoryUnavailable,
  };
}

export type { NoteBrowserStore } from "./note-browser-contracts.js";

function createRuntime(options: NoteBrowserStoreOptions): NoteBrowserRuntime {
  return {
    activeDraftFlush: undefined,
    activeNoteLoad: undefined,
    activeNoteSaves: new Map(),
    activeNotesLoad: undefined,
    api: getApi(options),
    context: {} as StoreContext,
    currentRouteIntentKey: undefined,
    draftPersistence: getDraftPersistence(options),
    draftWriteDelayMs: getDraftWriteDelayMs(options),
    editorSessionVersion: 0,
    hasPendingDraftWrite: false,
    noteRequestSequence: 0,
    notesRequestSequence: 0,
    pendingDraftTimer: undefined,
  };
}

function getApi(options: NoteBrowserStoreOptions): NoteBrowserApi {
  return options.api ?? defaultApi;
}

function getDraftPersistence(options: NoteBrowserStoreOptions): DraftPersistence {
  return options.draftPersistence ?? createDraftPersistence();
}

function getDraftWriteDelayMs(options: NoteBrowserStoreOptions): number {
  return options.draftWriteDelayMs ?? 250;
}

function createInitialState(
  runtime: NoteBrowserRuntime,
  set: StoreContext["set"],
  get: StoreContext["get"],
): NoteBrowserStore {
  configureContext(runtime, set, get);
  return {
    activateRouteIntent: (intentKey) => {
      activateRouteIntent(intentKey, runtime);
    },
    applyRoute: async (input) =>
      await applyRouteAction(input, runtime.context),
    clusterIdentity: undefined,
    committedRouteView: undefined,
    discardDraftAndReloadDiskVersion: async () => {
      await discardDraftAndReloadDiskVersionAction(runtime.context);
    },
    discardMissingDraft: async () => {
      await discardMissingDraftAction(runtime.context);
    },
    draftRecoveryStatus: { status: "available" },
    ensureNotes: async () => await ensureNotesAction(runtime.context),
    flushPendingDraft: async () => {
      await flushPendingDraft(runtime);
    },
    getCoherentView: (occurrence, noteId) =>
      getCoherentRouteView(
        { activeLoad: runtime.activeNoteLoad, noteId, occurrence },
        get(),
      ),
    getRenderedOwnerKey: () => getRenderedOwnerKey(get()),
    noteState: { status: "idle" },
    notesState: { status: "idle" },
    reportHistoryUnavailable: () => {
      set({
        routeHistoryStatus: {
          message:
            "Browser history could not confirm the previous note. Retry navigation from the current page.",
          reason: "route_history_unavailable",
          status: "degraded",
        },
      });
    },
    routeHistoryStatus: { status: "available" },
    saveSelectedNote: async () => {
      await saveSelectedNoteAction(runtime.context);
    },
    selectedNoteId: undefined,
    updateDraftMarkdown: (markdown) => {
      updateDraftMarkdown(markdown, runtime);
    },
    updateEditorMode: (editorMode) => {
      updateEditorMode(editorMode, runtime);
    },
  };
}

function configureContext(
  runtime: NoteBrowserRuntime,
  set: StoreContext["set"],
  get: StoreContext["get"],
): void {
  Object.assign(runtime.context, {
    api: runtime.api,
    clearActiveNoteLoad: (promise: ActiveNoteLoad["promise"]) => {
      if (runtime.activeNoteLoad?.promise === promise) {
        runtime.activeNoteLoad = undefined;
      }
    },
    clearActiveNoteSave: (noteId: string, promise: Promise<void>) => {
      if (runtime.activeNoteSaves.get(noteId)?.promise === promise) {
        runtime.activeNoteSaves.delete(noteId);
      }
    },
    clearActiveNotesLoad: (promise: ActiveNotesLoad["promise"]) => {
      if (runtime.activeNotesLoad?.promise === promise) {
        runtime.activeNotesLoad = undefined;
      }
    },
    draftPersistence: runtime.draftPersistence,
    get,
    getActiveNoteLoad: () => runtime.activeNoteLoad,
    getActiveNoteSave: (noteId: string) => runtime.activeNoteSaves.get(noteId),
    getActiveNotesLoad: () => runtime.activeNotesLoad,
    getCurrentRouteIntentKey: () => runtime.currentRouteIntentKey,
    isCurrentNoteRequest: (
      authorization: NoteLoadAuthorization,
      requestSequence: number,
      noteId: string,
    ) =>
      isCurrentNoteRequest(
        { authorization, noteId, requestSequence },
        runtime,
      ),
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
    setActiveNotesLoad: (load: ActiveNotesLoad) => {
      runtime.activeNotesLoad = load;
    },
    setCurrentRouteIntent: (intentKey: string) => {
      activateRouteIntent(intentKey, runtime);
    },
  } satisfies StoreContext);
}

function isCurrentNoteRequest(
  input: {
    readonly authorization: NoteLoadAuthorization;
    readonly noteId: string;
    readonly requestSequence: number;
  },
  runtime: NoteBrowserRuntime,
): boolean {
  if (
    input.requestSequence !== runtime.noteRequestSequence ||
    runtime.context.get().selectedNoteId !== input.noteId
  ) {
    return false;
  }
  return isCurrentAuthorization(input.authorization, runtime);
}

function isCurrentAuthorization(
  authorization: NoteLoadAuthorization,
  runtime: NoteBrowserRuntime,
): boolean {
  if (authorization.kind === "route_intent") {
    return runtime.currentRouteIntentKey === authorization.intentKey;
  }
  return (
    runtime.activeNoteLoad?.authorization.authorizationKey ===
    authorization.authorizationKey
  );
}

async function flushPendingDraft(runtime: NoteBrowserRuntime): Promise<void> {
  clearPendingDraftTimer(runtime);
  if (runtime.activeDraftFlush !== undefined) {
    await runtime.activeDraftFlush;
    return;
  }
  await startPendingDraftFlush(runtime);
}

async function startPendingDraftFlush(
  runtime: NoteBrowserRuntime,
): Promise<void> {
  if (!runtime.hasPendingDraftWrite) {
    return;
  }
  runtime.hasPendingDraftWrite = false;
  const promise = persistCurrentDraft(runtime.context).then(() => undefined);
  runtime.activeDraftFlush = promise;
  try {
    await promise;
  } finally {
    clearActiveDraftFlush(promise, runtime);
  }
}

function clearActiveDraftFlush(
  promise: Promise<void>,
  runtime: NoteBrowserRuntime,
): void {
  if (runtime.activeDraftFlush === promise) {
    runtime.activeDraftFlush = undefined;
  }
}

function scheduleDraftWrite(runtime: NoteBrowserRuntime): void {
  runtime.hasPendingDraftWrite = true;
  clearPendingDraftTimer(runtime);
  runtime.pendingDraftTimer = setTimeout(() => {
    void flushPendingDraft(runtime);
  }, runtime.draftWriteDelayMs);
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

function activateRouteIntent(
  intentKey: string,
  runtime: NoteBrowserRuntime,
): void {
  if (runtime.currentRouteIntentKey === intentKey) {
    return;
  }
  runtime.currentRouteIntentKey = intentKey;
  incrementNoteRequestSequence(runtime);
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
