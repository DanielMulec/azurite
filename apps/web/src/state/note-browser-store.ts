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
import { DraftPersistenceCoordinator } from "../persistence/draft-persistence-coordinator.js";
import type { RouteStoreExecutor } from "../routing/route-store-executor.js";
import type { NoteLoadAuthorization } from "../routing/route-transition-types.js";
import {
  applyRouteAction,
  discardDraftAndReloadDiskVersionAction,
  discardMissingDraftAction,
  ensureNotesAction,
  saveSelectedNoteAction,
} from "./note-browser-actions.js";
import {
  publishMarkdownChange,
  retryDraftPersistenceAction,
  updateEditorModeWithSnapshot,
} from "./note-browser-authority-actions.js";
import { flushEditorDurability } from "./note-browser-durability-actions.js";
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
import {
  createRouteApplicationRollback,
  type RouteApplicationRollback,
} from "./note-browser-route-rollback.js";

type NoteBrowserStoreOptions = {
  readonly api?: NoteBrowserApi;
  readonly draftPersistence?: DraftPersistence;
  readonly draftWriteDelayMs?: number;
};

type NoteBrowserRuntime = {
  activeNoteLoad: ActiveNoteLoad | undefined;
  readonly activeNoteSaves: Map<string, ActiveNoteSave>;
  activeNotesLoad: ActiveNotesLoad | undefined;
  readonly api: NoteBrowserApi;
  readonly context: StoreContext;
  currentRouteIntentKey: string | undefined;
  readonly draftPersistence: DraftPersistence;
  readonly draftCoordinator: DraftPersistenceCoordinator;
  editorSessionVersion: number;
  noteRequestSequence: number;
  notesRequestSequence: number;
  snapshotVersion: number;
  readonly routeRollback: RouteApplicationRollback;
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
  const draftPersistence = getDraftPersistence(options);
  return {
    activeNoteLoad: undefined,
    activeNoteSaves: new Map(),
    activeNotesLoad: undefined,
    api: getApi(options),
    context: {} as StoreContext,
    currentRouteIntentKey: undefined,
    draftCoordinator: new DraftPersistenceCoordinator({
      delayMs: getDraftWriteDelayMs(options),
      persistence: draftPersistence,
    }),
    draftPersistence,
    editorSessionVersion: 0,
    noteRequestSequence: 0,
    notesRequestSequence: 0,
    snapshotVersion: 0,
    routeRollback: createRouteApplicationRollback(),
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
    applyRoute: (input) => applyRouteAction(input, runtime.context),
    clusterIdentity: undefined,
    committedRouteView: undefined,
    discardDraftAndReloadDiskVersion: async () => {
      await discardDraftAndReloadDiskVersionAction(runtime.context);
    },
    discardMissingDraft: async () => {
      await discardMissingDraftAction(runtime.context);
    },
    draftRecoveryStatus: { status: "available" },
    ensureNotes: () => ensureNotesAction(runtime.context),
    flushPendingDraft: async () => {
      await flushEditorDurability("explicit_flush", runtime.context);
    },
    getCoherentView: (occurrence, noteId) =>
      getCoherentRouteView(
        { activeLoad: runtime.activeNoteLoad, noteId, occurrence },
        get(),
      ),
    getRenderedOwnerKey: () => getRenderedOwnerKey(get()),
    noteState: { status: "idle" },
    notesState: { status: "idle" },
    publishMarkdownChange: (command) =>
      publishMarkdownChange(command, runtime.context),
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
    retryBrowserRecovery: async () => {},
    retryDraftCleanup: async () => {},
    retryDraftPersistence: async () => {
      await retryDraftPersistenceAction(runtime.context);
    },
    saveSelectedNote: () => saveSelectedNoteAction(runtime.context),
    selectedNoteId: undefined,
    updateDraftMarkdown: (markdown) => {
      const noteState = get().noteState;
      if (noteState.status !== "ready") {
        return;
      }
      publishMarkdownChange(
        {
          markdown,
          origin: "source_input",
          resolution: "exact_input",
          sessionKey: noteState.editor.sessionKey,
          trigger: "direct_input",
        },
        runtime.context,
      );
    },
    updateEditorMode: (editorMode) => {
      updateEditorModeWithSnapshot(editorMode, runtime.context);
    },
  };
}

function configureContext(
  runtime: NoteBrowserRuntime,
  set: StoreContext["set"],
  get: StoreContext["get"],
): void {
  Object.assign(runtime.context, {
    ...createRouteRollbackContext(runtime, set, get),
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
    draftCoordinator: runtime.draftCoordinator,
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
      isCurrentNoteRequest({ authorization, noteId, requestSequence }, runtime),
    isCurrentNotesRequest: (requestSequence: number) =>
      requestSequence === runtime.notesRequestSequence,
    nextEditorSessionKey: (noteId: string, contentHash: string) =>
      nextEditorSessionKey(noteId, contentHash, runtime),
    nextSnapshotKey: (sessionKey: string, revision: number) =>
      nextSnapshotKey(sessionKey, revision, runtime),
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

function createRouteRollbackContext(
  runtime: NoteBrowserRuntime,
  set: StoreContext["set"],
  get: StoreContext["get"],
): Pick<
  StoreContext,
  "beginRouteApplication" | "commitRouteApplication" | "restoreRoutePredecessor"
> {
  return {
    beginRouteApplication: () => {
      runtime.routeRollback.begin(get());
    },
    commitRouteApplication: runtime.routeRollback.commit,
    restoreRoutePredecessor: () => {
      runtime.routeRollback.restore(get(), set);
    },
  };
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

function activateRouteIntent(
  intentKey: string,
  runtime: NoteBrowserRuntime,
): void {
  if (runtime.currentRouteIntentKey === intentKey) {
    return;
  }
  runtime.currentRouteIntentKey = intentKey;
  if (runtime.activeNoteLoad !== undefined) {
    incrementNoteRequestSequence(runtime);
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

function nextSnapshotKey(
  sessionKey: string,
  revision: number,
  runtime: NoteBrowserRuntime,
): string {
  runtime.snapshotVersion += 1;
  return `${sessionKey}:revision:${String(revision)}:snapshot:${String(runtime.snapshotVersion)}`;
}

function incrementNoteRequestSequence(runtime: NoteBrowserRuntime): number {
  runtime.noteRequestSequence += 1;
  return runtime.noteRequestSequence;
}

function incrementNotesRequestSequence(runtime: NoteBrowserRuntime): number {
  runtime.notesRequestSequence += 1;
  return runtime.notesRequestSequence;
}
