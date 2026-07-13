import type { StoreApi } from "zustand/vanilla";

import type { NoteBrowserStore } from "./note-browser-contracts.js";

type RoutePredecessor = Pick<
  NoteBrowserStore,
  "committedRouteView" | "noteState" | "routeHistoryStatus" | "selectedNoteId"
>;

/** Ephemeral rollback owner for one joined chain of route applications. */
export type RouteApplicationRollback = {
  readonly begin: (state: NoteBrowserStore) => void;
  readonly commit: () => void;
  readonly restore: (
    state: NoteBrowserStore,
    set: StoreApi<NoteBrowserStore>["setState"],
  ) => void;
};

/** Preserves the coherent predecessor while superseding intents overlap. */
export function createRouteApplicationRollback(): RouteApplicationRollback {
  let predecessor: RoutePredecessor | undefined;
  return {
    begin: (state) => {
      predecessor ??= capturePredecessor(state);
    },
    commit: () => {
      predecessor = undefined;
    },
    restore: (state, set) => {
      const captured = predecessor;
      predecessor = undefined;
      if (captured === undefined) {
        return;
      }
      restorePredecessor(captured, state, set);
    },
  };
}

function capturePredecessor(state: NoteBrowserStore): RoutePredecessor {
  return {
    committedRouteView: state.committedRouteView,
    noteState: state.noteState,
    routeHistoryStatus: state.routeHistoryStatus,
    selectedNoteId: state.selectedNoteId,
  };
}

function restorePredecessor(
  predecessor: RoutePredecessor,
  current: NoteBrowserStore,
  set: StoreApi<NoteBrowserStore>["setState"],
): void {
  try {
    set({
      ...predecessor,
      noteState: getRestoredNoteState(predecessor, current),
    });
  } catch {
    // Zustand mutates state before subscribers run, so restoration still lands.
  }
}

function getRestoredNoteState(
  predecessor: RoutePredecessor,
  current: NoteBrowserStore,
): NoteBrowserStore["noteState"] {
  return hasSameRenderedOwner(predecessor, current)
    ? current.noteState
    : predecessor.noteState;
}

function hasSameRenderedOwner(
  predecessor: RoutePredecessor,
  current: NoteBrowserStore,
): boolean {
  const ownerKey = predecessor.committedRouteView?.renderedOwnerKey;
  if (ownerKey === undefined) {
    return false;
  }
  return (
    hasReadyOwner(current, ownerKey) || hasMissingDraftOwner(current, ownerKey)
  );
}

function hasReadyOwner(current: NoteBrowserStore, ownerKey: string): boolean {
  return (
    current.noteState.status === "ready" &&
    current.noteState.editor.sessionKey === ownerKey
  );
}

function hasMissingDraftOwner(
  current: NoteBrowserStore,
  ownerKey: string,
): boolean {
  return (
    current.noteState.status === "missing-draft" &&
    current.noteState.renderedOwnerKey === ownerKey
  );
}
