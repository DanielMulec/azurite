import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import {
  createNoteBrowserStore,
  type NoteBrowserStore,
} from "./state/note-browser-store.js";
import type {
  DraftRecoveryStatus,
  LoadableNotes,
  NoteViewState,
} from "./state/note-browser-types.js";

type NoteBrowserNavigation = {
  readonly pushSelectedNote: (noteId: string) => void;
  readonly replaceSelectedNote: (noteId: string) => void;
};

type UseNoteBrowserInput = {
  readonly navigation: NoteBrowserNavigation;
  readonly routeNoteId: string | undefined;
};

type NoteBrowserStoreApi = ReturnType<typeof createNoteBrowserStore>;

type NoteBrowserSelectors = Omit<NoteBrowserState, "selectNote"> & {
  readonly selectNoteInStore: NoteBrowserStore["selectNote"];
};

type RouteEffectInput = {
  readonly routeNavigation: Pick<NoteBrowserNavigation, "replaceSelectedNote">;
  readonly routeNoteId: string | undefined;
  readonly store: NoteBrowserStoreApi;
};

/** State and actions for the editable note browsing screen. */
export type NoteBrowserState = {
  readonly discardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly discardMissingDraft: () => Promise<void>;
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly noteState: NoteViewState;
  readonly notesState: LoadableNotes;
  readonly saveSelectedNote: () => Promise<void>;
  readonly selectedNoteId: string | undefined;
  readonly selectNote: (noteId: string) => void;
  readonly updateDraftMarkdown: (markdown: string) => void;
  readonly updateEditorMode: (editorMode: "markdown" | "wysiwyg") => void;
};

/** Connects React route state to the note browser store. */
export function useNoteBrowser({
  navigation,
  routeNoteId,
}: UseNoteBrowserInput): NoteBrowserState {
  const [store] = useState(createNoteBrowserStore);
  const routeNavigation = useRouteNavigation(navigation);
  const selectors = useNoteBrowserSelectors(store);
  const selectNote = usePushSelectingNote(navigation, selectors);
  const routeEffectInput = useMemo(
    () => ({
      routeNavigation,
      routeNoteId,
      store,
    }),
    [routeNavigation, routeNoteId, store],
  );

  useRouteDrivenNoteLoading(routeEffectInput);
  useDraftLifecycleFlush(store);

  return {
    discardDraftAndReloadDiskVersion:
      selectors.discardDraftAndReloadDiskVersion,
    discardMissingDraft: selectors.discardMissingDraft,
    draftRecoveryStatus: selectors.draftRecoveryStatus,
    noteState: selectors.noteState,
    notesState: selectors.notesState,
    saveSelectedNote: selectors.saveSelectedNote,
    selectNote,
    selectedNoteId: selectors.selectedNoteId,
    updateDraftMarkdown: selectors.updateDraftMarkdown,
    updateEditorMode: selectors.updateEditorMode,
  };
}

function useRouteNavigation(navigation: NoteBrowserNavigation) {
  return useMemo(
    () => ({ replaceSelectedNote: navigation.replaceSelectedNote }),
    [navigation.replaceSelectedNote],
  );
}

function useNoteBrowserSelectors(
  store: NoteBrowserStoreApi,
): NoteBrowserSelectors {
  return {
    discardDraftAndReloadDiskVersion: useStore(
      store,
      (state) => state.discardDraftAndReloadDiskVersion,
    ),
    discardMissingDraft: useStore(store, (state) => state.discardMissingDraft),
    draftRecoveryStatus: useStore(store, (state) => state.draftRecoveryStatus),
    noteState: useStore(store, (state) => state.noteState),
    notesState: useStore(store, (state) => state.notesState),
    saveSelectedNote: useStore(store, (state) => state.saveSelectedNote),
    selectNoteInStore: useStore(store, (state) => state.selectNote),
    selectedNoteId: useStore(store, (state) => state.selectedNoteId),
    updateDraftMarkdown: useStore(store, (state) => state.updateDraftMarkdown),
    updateEditorMode: useStore(store, (state) => state.updateEditorMode),
  };
}

function useRouteDrivenNoteLoading(input: RouteEffectInput): void {
  const didLoadNotesRef = useRef(false);
  const loadNotes = useStore(input.store, (state) => state.loadNotes);
  const syncRouteNote = useStore(input.store, (state) => state.syncRouteNote);

  useEffect(() => {
    if (didLoadNotesRef.current) {
      return;
    }

    didLoadNotesRef.current = true;
    void loadNotes(input.routeNoteId, input.routeNavigation);
  }, [didLoadNotesRef, input, loadNotes]);

  useEffect(() => {
    if (!didLoadNotesRef.current) {
      return;
    }

    void syncRouteNote(input.routeNoteId, input.routeNavigation);
  }, [didLoadNotesRef, input, syncRouteNote]);
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

function usePushSelectingNote(
  navigation: NoteBrowserNavigation,
  selectors: NoteBrowserSelectors,
): (noteId: string) => void {
  return useCallback(
    (noteId: string) => {
      void selectors.selectNoteInStore(noteId).then(() => {
        if (noteId !== selectors.selectedNoteId) {
          navigation.pushSelectedNote(noteId);
        }
      });
    },
    [navigation, selectors],
  );
}
