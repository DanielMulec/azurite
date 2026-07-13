import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";

import type { RouteTransitionOwner } from "./routing/route-transition-owner.js";
import type { RouteTransitionGate } from "./routing/route-transition-types.js";
import { createBaselineRouteDraftGate } from "./state/baseline-route-draft-gate.js";
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

/** Factory injected only when an acceptance entry replaces the production gate. */
export type NoteBrowserRouteGateFactory = (
  store: NoteBrowserStoreApi,
) => RouteTransitionGate;

/** State and actions for the editable note browsing screen. */
export type NoteBrowserState = {
  readonly discardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly discardMissingDraft: () => Promise<void>;
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly noteState: NoteViewState;
  readonly notesState: LoadableNotes;
  readonly routeHistoryStatus: RouteHistoryStatus;
  readonly saveSelectedNote: () => Promise<void>;
  readonly selectedNoteId: string | undefined;
  readonly selectNote: (noteId: string) => void;
  readonly updateDraftMarkdown: (markdown: string) => void;
  readonly updateEditorMode: (editorMode: "markdown" | "wysiwyg") => void;
};

/** Connects the route owner and React UI to one note-browser store. */
export function useNoteBrowser(
  transitionOwner: RouteTransitionOwner,
  createRouteGate: NoteBrowserRouteGateFactory = createBaselineRouteDraftGate,
): NoteBrowserState {
  const [store] = useState(createNoteBrowserStore);
  useRouteRuntimeRegistration(store, transitionOwner, createRouteGate);
  useDraftLifecycleFlush(store);
  const state = useNoteBrowserSelectors(store);
  const selectNote = useCallback(
    (noteId: string) => {
      void transitionOwner.selectNote(noteId);
    },
    [transitionOwner],
  );

  return { ...state, selectNote };
}

function useRouteRuntimeRegistration(
  store: NoteBrowserStoreApi,
  transitionOwner: RouteTransitionOwner,
  createRouteGate: NoteBrowserRouteGateFactory,
): void {
  useEffect(() => {
    const unregisterGate = transitionOwner.registerGate(createRouteGate(store));
    const unregisterExecutor = transitionOwner.registerStoreExecutor(
      createNoteBrowserRouteExecutor(store),
    );
    return () => {
      unregisterExecutor();
      unregisterGate();
    };
  }, [createRouteGate, store, transitionOwner]);
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
    routeHistoryStatus: useStore(store, (state) => state.routeHistoryStatus),
    saveSelectedNote: useStore(store, (state) => state.saveSelectedNote),
    selectedNoteId: useStore(store, (state) => state.selectedNoteId),
    updateDraftMarkdown: useStore(store, (state) => state.updateDraftMarkdown),
    updateEditorMode: useStore(store, (state) => state.updateEditorMode),
  };
}

function useDraftLifecycleFlush(store: NoteBrowserStoreApi): void {
  useEffect(() => {
    const flushDraft = () => {
      void store.getState().flushPendingDraft();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushDraft();
      }
    };

    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("pagehide", flushDraft);
    };
  }, [store]);
}
