import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";

import {
  createEditorSessionGate,
  type EditorSessionGate,
} from "./components/editor-session-gate.js";
import type {
  PublicationCommand,
  PublicationResult,
} from "./domain/markdown-authority-types.js";
import type { RouteTransitionOwner } from "./routing/route-transition-owner.js";
import type { RouteTransitionGate } from "./routing/route-transition-types.js";
import {
  createNoteBrowserRouteExecutor,
  createNoteBrowserStore,
} from "./state/note-browser-store.js";
import type {
  DraftRecoveryStatus,
  LoadableNotes,
  NoteViewState,
} from "./state/note-browser-types.js";
import type { RouteHistoryStatus } from "./routing/route-transition-types.js";

type NoteBrowserStoreApi = ReturnType<typeof createNoteBrowserStore>;

/** Acceptance-only decorator around the production editor gate. */
export type NoteBrowserRouteGateFactory = (
  store: NoteBrowserStoreApi,
  productionGate: RouteTransitionGate,
) => RouteTransitionGate;

/** State and actions for the editable note browsing screen. */
export type NoteBrowserState = {
  readonly discardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly discardMissingDraft: () => Promise<void>;
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly editorSessionGate: EditorSessionGate;
  readonly noteState: NoteViewState;
  readonly notesState: LoadableNotes;
  readonly routeHistoryStatus: RouteHistoryStatus;
  readonly publishMarkdownChange: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly retryBrowserRecovery: () => Promise<unknown>;
  readonly retryDraftCleanup: () => Promise<void>;
  readonly retryDraftPersistence: () => Promise<void>;
  readonly saveSelectedNote: () => Promise<void>;
  readonly selectedNoteId: string | undefined;
  readonly selectNote: (noteId: string) => void;
  readonly updateDraftMarkdown: (markdown: string) => void;
  readonly updateEditorMode: (editorMode: "markdown" | "wysiwyg") => void;
};

/** Connects the route owner and React UI to one note-browser store. */
export function useNoteBrowser(
  transitionOwner: RouteTransitionOwner,
  createRouteGate?: NoteBrowserRouteGateFactory,
): NoteBrowserState {
  const [store] = useState(createNoteBrowserStore);
  const [editorSessionGate] = useState(() => createEditorSessionGate(store));
  useRouteRuntimeRegistration(
    store,
    transitionOwner,
    editorSessionGate,
    createRouteGate,
  );
  useDraftLifecycleFlush(editorSessionGate);
  const state = useNoteBrowserSelectors(store);
  const selectNote = useCallback(
    (noteId: string) => {
      void transitionOwner.selectNote(noteId);
    },
    [transitionOwner],
  );

  return { ...state, editorSessionGate, selectNote };
}

function useRouteRuntimeRegistration(
  store: NoteBrowserStoreApi,
  transitionOwner: RouteTransitionOwner,
  editorSessionGate: EditorSessionGate,
  createRouteGate: NoteBrowserRouteGateFactory | undefined,
): void {
  useEffect(() => {
    const productionGate = editorSessionGate.routeGate;
    const gate = createRouteGate?.(store, productionGate) ?? productionGate;
    const unregisterGate = transitionOwner.registerGate(gate);
    const unregisterExecutor = transitionOwner.registerStoreExecutor(
      createNoteBrowserRouteExecutor(store),
    );
    return () => {
      unregisterExecutor();
      unregisterGate();
    };
  }, [createRouteGate, editorSessionGate, store, transitionOwner]);
}

function useNoteBrowserSelectors(store: NoteBrowserStoreApi) {
  return {
    discardDraftAndReloadDiskVersion: useStore(
      store,
      (state) => state.discardDraftAndReloadDiskVersion,
    ),
    discardMissingDraft: useStore(store, (state) => state.discardMissingDraft),
    draftRecoveryStatus: useStore(store, (state) => state.draftRecoveryStatus),
    noteState: useStore(store, (state) => state.noteState),
    notesState: useStore(store, (state) => state.notesState),
    publishMarkdownChange: useStore(
      store,
      (state) => state.publishMarkdownChange,
    ),
    routeHistoryStatus: useStore(store, (state) => state.routeHistoryStatus),
    retryBrowserRecovery: useStore(
      store,
      (state) => state.retryBrowserRecovery,
    ),
    retryDraftCleanup: useStore(store, (state) => state.retryDraftCleanup),
    retryDraftPersistence: useStore(
      store,
      (state) => state.retryDraftPersistence,
    ),
    saveSelectedNote: useStore(store, (state) => state.saveSelectedNote),
    selectedNoteId: useStore(store, (state) => state.selectedNoteId),
    updateDraftMarkdown: useStore(store, (state) => state.updateDraftMarkdown),
    updateEditorMode: useStore(store, (state) => state.updateEditorMode),
  };
}

function useDraftLifecycleFlush(editorSessionGate: EditorSessionGate): void {
  useEffect(() => {
    const flushDraft = (cause: "pagehide" | "visibilitychange") => {
      void editorSessionGate.commitLifecycle(cause);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushDraft("visibilitychange");
      }
    };
    const flushOnPageHide = () => {
      flushDraft("pagehide");
    };

    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
    };
  }, [editorSessionGate]);
}
