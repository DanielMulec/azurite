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
import { createNoteBrowserRouteWorkflow } from "./note-browser-route-workflow.js";

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
    const route = createNoteBrowserRouteWorkflow({
      api,
      draftCoordinator: coordinator,
      state,
    });
    const allocateSnapshotKey = createSnapshotKeyAllocator();
    const saveSelectedNote = createSaveSelectedNoteAction({
      allocateSnapshotKey,
      api,
      draft,
    });
    routeExecutor = route.executor;

    return {
      clusterIdentity: undefined,
      committedRouteView: undefined,
      discardCurrentDraft: async () => {
        await discardCurrentDraftAction({
          coordinator,
          dismissMissingDraft: route.dismissMissingDraft,
          reloadSelectedNote: route.reloadSelectedNote,
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
        await retryDraftPersistenceIssueAction(
          draft,
          route.retryBrowserRecovery,
        );
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

  if (routeExecutor === undefined) {
    throw new Error("The note-browser route workflow was not constructed.");
  }
  return Object.assign(store, { routeExecutor });
}

export type { NoteBrowserStore } from "./note-browser-contracts.js";
