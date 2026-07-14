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
import { createNoteBrowserStore } from "./state/note-browser-store.js";
import type {
  DraftRecoveryStatus,
  EditorSessionReader,
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
  readonly discardCurrentDraft: () => Promise<void>;
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly editorSessionGate: EditorSessionGate;
  readonly noteState: NoteViewState;
  readonly notesState: LoadableNotes;
  readonly routeHistoryStatus: RouteHistoryStatus;
  readonly publishMarkdownChange: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly readEditorSession: EditorSessionReader;
  readonly retryDraftPersistenceIssue: () => Promise<void>;
  readonly saveSelectedNote: () => Promise<void>;
  readonly selectedNoteId: string | undefined;
  readonly selectNote: (noteId: string) => void;
  readonly updateEditorMode: (editorMode: "markdown" | "wysiwyg") => void;
};

/** Connects the route owner and React UI to one note-browser store. */
export function useNoteBrowser(
  transitionOwner: RouteTransitionOwner,
  createRouteGate?: NoteBrowserRouteGateFactory,
): NoteBrowserState {
  const [store] = useState(createNoteBrowserStore);
  const [editorSessionGate] = useState(() => createEditorSessionGate(store));
  const [readEditorSession] = useState<EditorSessionReader>(
    () => (sessionKey: string) => {
      const noteState = store.getState().noteState;
      return noteState.status === "ready" &&
        noteState.editor.sessionKey === sessionKey
        ? noteState.editor
        : undefined;
    },
  );
  useRouteRuntimeRegistration({
    createRouteGate,
    editorSessionGate,
    store,
    transitionOwner,
  });
  useDraftLifecycleFlush(editorSessionGate);
  const state = useNoteBrowserSelectors(store);
  const selectNote = useCallback(
    (noteId: string) => {
      void transitionOwner.selectNote(noteId);
    },
    [transitionOwner],
  );

  return { ...state, editorSessionGate, readEditorSession, selectNote };
}

function useRouteRuntimeRegistration(input: {
  readonly createRouteGate: NoteBrowserRouteGateFactory | undefined;
  readonly editorSessionGate: EditorSessionGate;
  readonly store: NoteBrowserStoreApi;
  readonly transitionOwner: RouteTransitionOwner;
}): void {
  const { createRouteGate, editorSessionGate, store, transitionOwner } = input;
  useEffect(() => {
    const productionGate = editorSessionGate.routeGate;
    const gate = createRouteGate?.(store, productionGate) ?? productionGate;
    const unregisterGate = transitionOwner.registerGate(gate);
    const unregisterExecutor = transitionOwner.registerStoreExecutor(
      store.routeExecutor,
    );
    return () => {
      unregisterExecutor();
      unregisterGate();
    };
  }, [createRouteGate, editorSessionGate, store, transitionOwner]);
}

function useNoteBrowserSelectors(store: NoteBrowserStoreApi) {
  return {
    discardCurrentDraft: useStore(
      store,
      (state) => state.discardCurrentDraft,
    ),
    draftRecoveryStatus: useStore(store, (state) => state.draftRecoveryStatus),
    noteState: useStore(store, (state) => state.noteState),
    notesState: useStore(store, (state) => state.notesState),
    publishMarkdownChange: useStore(
      store,
      (state) => state.publishMarkdownChange,
    ),
    routeHistoryStatus: useStore(store, (state) => state.routeHistoryStatus),
    retryDraftPersistenceIssue: useStore(
      store,
      (state) => state.retryDraftPersistenceIssue,
    ),
    saveSelectedNote: useStore(store, (state) => state.saveSelectedNote),
    selectedNoteId: useStore(store, (state) => state.selectedNoteId),
    updateEditorMode: useStore(store, (state) => state.updateEditorMode),
  };
}

function useDraftLifecycleFlush(editorSessionGate: EditorSessionGate): void {
  useEffect(() => {
    const flushDraft = (cause: "pagehide" | "unmount" | "visibilitychange") => {
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
      flushDraft("unmount");
    };
  }, [editorSessionGate]);
}
