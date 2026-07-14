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
import { DraftCleanupRetryRegistry } from "../persistence/draft-cleanup-retry-registry.js";
import type { RouteStoreExecutor } from "../routing/route-store-executor.js";
import {
  publishMarkdownChange,
  updateEditorModeWithSnapshot,
} from "./note-browser-authority-actions.js";
import { discardCurrentDraftAction } from "./note-browser-discard-actions.js";
import {
  createSnapshotKeyAllocator,
  type DraftWorkflowAccess,
} from "./note-browser-draft-runtime.js";
import { flushEditorDurability } from "./note-browser-durability-actions.js";
import { createSaveSelectedNoteAction } from "./note-browser-editor-actions.js";
import { retryDraftPersistenceIssueAction } from "./note-browser-retry-actions.js";
import type {
  NoteBrowserApi,
  NoteBrowserStateAccess,
  NoteBrowserStore,
} from "./note-browser-contracts.js";
import { retryBrowserRecoveryAction } from "./note-browser-recovery-actions.js";
import {
  applyRouteAction,
  ensureNotesAction,
  reloadSelectedNoteAction,
} from "./note-browser-route-actions.js";
import {
  getCoherentRouteView,
  getRenderedOwnerKey,
} from "./note-browser-route-predicates.js";
import {
  activateRouteIntent,
  allocateEditorSessionKey,
  createRouteWorkflowRuntime,
  dismissMissingDraft,
  reportHistoryUnavailable,
  type RouteWorkflowAccess,
} from "./note-browser-route-runtime.js";

type NoteBrowserStoreOptions = {
  readonly api?: NoteBrowserApi;
  readonly draftPersistence?: DraftPersistence;
  readonly draftWriteDelayMs?: number;
};

/** Zustand store API paired with its directly owned route executor. */
export type NoteBrowserStoreApi = StoreApi<NoteBrowserStore> & {
  readonly routeExecutor: RouteStoreExecutor;
};

const defaultApi: NoteBrowserApi = {
  listNotes,
  readNote,
  saveNote: saveNoteRequest,
};

/** Creates note-browser product state and its workflow-owned operations. */
export function createNoteBrowserStore(
  options: NoteBrowserStoreOptions = {},
): NoteBrowserStoreApi {
  const api = options.api ?? defaultApi;
  const persistence = options.draftPersistence ?? createDraftPersistence();
  const coordinator = new DraftPersistenceCoordinator({
    delayMs: options.draftWriteDelayMs ?? 250,
    persistence,
  });
  const cleanupRetries = new DraftCleanupRetryRegistry();
  let routeExecutor: RouteStoreExecutor | undefined;

  const store = createStore<NoteBrowserStore>((setState, getState) => {
    const state: NoteBrowserStateAccess = { getState, setState };
    const draft: DraftWorkflowAccess = {
      cleanupRetries,
      coordinator,
      state,
    };
    const route: RouteWorkflowAccess = {
      api,
      draftCoordinator: coordinator,
      state,
    };
    const routeRuntime = createRouteWorkflowRuntime();
    const allocateSnapshotKey = createSnapshotKeyAllocator();
    const saveSelectedNote = createSaveSelectedNoteAction({
      allocateSnapshotKey,
      api,
      draft,
    });
    routeExecutor = {
      activateRouteIntent: (intentKey) => {
        activateRouteIntent(intentKey, routeRuntime);
      },
      applyRoute: (input) => applyRouteAction(input, route, routeRuntime),
      ensureNotes: () => ensureNotesAction(route, routeRuntime),
      getCoherentView: (occurrence, noteId) =>
        getCoherentRouteView(
          { activeLoad: routeRuntime.activeNoteLoad, noteId, occurrence },
          state.getState(),
        ),
      getRenderedOwnerKey: () => getRenderedOwnerKey(state.getState()),
      reportHistoryUnavailable: () => {
        reportHistoryUnavailable(state);
      },
    };

    return {
      clusterIdentity: undefined,
      committedRouteView: undefined,
      discardCurrentDraft: async () => {
        await discardCurrentDraftAction({
          coordinator,
          dismissMissingDraft: (noteId) => {
            dismissMissingDraft(
              noteId,
              state,
              routeRuntime.routeRollback.commit,
            );
          },
          reloadSelectedNote: async () =>
            await reloadSelectedNoteAction(route, routeRuntime),
          state,
        });
      },
      draftRecoveryStatus: { status: "available" },
      flushPendingDraft: async (cause = "explicit_flush") =>
        await flushEditorDurability(cause, state, coordinator),
      noteState: { status: "idle" },
      notesState: { status: "idle" },
      publishMarkdownChange: (command) =>
        publishMarkdownChange(command, {
          ...draft,
          allocateSnapshotKey,
        }),
      retryDraftPersistenceIssue: async () => {
        await retryDraftPersistenceIssueAction(draft, async () => {
          await retryBrowserRecoveryAction(route, (noteId, contentHash) =>
            allocateEditorSessionKey(noteId, contentHash, routeRuntime),
          );
        });
      },
      routeHistoryStatus: { status: "available" },
      saveSelectedNote,
      selectedNoteId: undefined,
      updateEditorMode: (editorMode) => {
        updateEditorModeWithSnapshot(editorMode, {
          ...draft,
          allocateSnapshotKey,
        });
      },
    };
  });

  return attachRouteExecutor(store, routeExecutor);
}

function attachRouteExecutor(
  store: StoreApi<NoteBrowserStore>,
  routeExecutor: RouteStoreExecutor | undefined,
): NoteBrowserStoreApi {
  if (routeExecutor === undefined) {
    throw new Error("The note-browser route workflow was not constructed.");
  }
  return Object.assign(store, { routeExecutor });
}

export type { NoteBrowserStore } from "./note-browser-contracts.js";
