import type { ValidatedLocationOccurrence } from "../routing/route-transition-types.js";
import type {
  NoteBrowserStore,
  NoteBrowserStateAccess,
} from "./note-browser-contracts.js";
import type { EditorSession, MissingNoteDraft } from "./note-browser-types.js";

type NoteRouteIdentity = {
  readonly location: ValidatedLocationOccurrence;
  readonly noteId: string;
  readonly statePatch?: RouteSupplementalState;
};

type RouteSupplementalState = Partial<
  Pick<NoteBrowserStore, "clusterIdentity" | "draftRecoveryStatus">
>;

type RouteStatePatch =
  | Partial<NoteBrowserStore>
  | ((state: NoteBrowserStore) => Partial<NoteBrowserStore>);

/** Applies and commits one ready editor surface as a single store mutation. */
export function applyReadyRoute(
  input: NoteRouteIdentity & { readonly editor: EditorSession },
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): boolean {
  return applyCommittedRoutePatch(
    {
      ...input.statePatch,
      committedRouteView: {
        location: input.location,
        noteId: input.noteId,
        renderedOwnerKey: input.editor.sessionKey,
        view: "ready",
      },
      noteState: { editor: input.editor, status: "ready" },
      routeHistoryStatus: { status: "available" },
      selectedNoteId: input.noteId,
    },
    state,
    commitRouteApplication,
  );
}

/** Applies and commits one missing-note surface without an editor owner. */
export function applyMissingRoute(
  input: NoteRouteIdentity,
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): boolean {
  return applyCommittedRoutePatch(
    {
      ...input.statePatch,
      committedRouteView: {
        location: input.location,
        noteId: input.noteId,
        renderedOwnerKey: undefined,
        view: "missing",
      },
      noteState: { noteId: input.noteId, status: "missing" },
      routeHistoryStatus: { status: "available" },
      selectedNoteId: input.noteId,
    },
    state,
    commitRouteApplication,
  );
}

/** Applies and commits one recovered missing-note draft with live owner identity. */
export function applyMissingDraftRoute(
  input: NoteRouteIdentity & {
    readonly draft: MissingNoteDraft;
    readonly renderedOwnerKey: string;
  },
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): boolean {
  return applyCommittedRoutePatch(
    {
      ...input.statePatch,
      committedRouteView: {
        location: input.location,
        noteId: input.noteId,
        renderedOwnerKey: input.renderedOwnerKey,
        view: "missing_draft",
      },
      noteState: {
        draft: input.draft,
        draftDisposition: "recovered",
        draftEpoch: 0,
        noteId: input.noteId,
        persistenceIssue: undefined,
        preservedSchemaVersion: undefined,
        renderedOwnerKey: input.renderedOwnerKey,
        status: "missing-draft",
      },
      routeHistoryStatus: { status: "available" },
      selectedNoteId: input.noteId,
    },
    state,
    commitRouteApplication,
  );
}

/** Applies and commits one target-owned note-read error surface. */
export function applyErrorRoute(
  input: NoteRouteIdentity & { readonly message: string },
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): boolean {
  return applyCommittedRoutePatch(
    {
      ...input.statePatch,
      committedRouteView: {
        location: input.location,
        noteId: input.noteId,
        renderedOwnerKey: undefined,
        view: "error",
      },
      noteState: {
        message: input.message,
        noteId: input.noteId,
        status: "error",
      },
      routeHistoryStatus: { status: "available" },
      selectedNoteId: input.noteId,
    },
    state,
    commitRouteApplication,
  );
}

/** Applies and commits the explicit empty-cluster route surface. */
export function applyEmptyRoute(
  location: ValidatedLocationOccurrence,
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): boolean {
  return applyCommittedRoutePatch(
    {
      committedRouteView: {
        location,
        noteId: undefined,
        renderedOwnerKey: undefined,
        view: "empty",
      },
      noteState: { status: "idle" },
      routeHistoryStatus: { status: "available" },
      selectedNoteId: undefined,
    },
    state,
    commitRouteApplication,
  );
}

/** Selects a current target while retaining an outgoing rendered projection. */
export function applyPendingRouteSelection(
  noteId: string,
  state: NoteBrowserStateAccess,
): boolean {
  return applyStorePatchAtomically(
    (state) => ({
      noteState: keepRenderedSurface(state),
      selectedNoteId: noteId,
    }),
    state,
  );
}

/** Applies one state mutation and restores the exact snapshot after a throw. */
export function applyStorePatchAtomically(
  patch: RouteStatePatch,
  state: NoteBrowserStateAccess,
): boolean {
  const previous = state.getState();
  try {
    state.setState(patch);
    return true;
  } catch {
    restorePreviousState(previous, state);
    return false;
  }
}

function applyCommittedRoutePatch(
  patch: RouteStatePatch,
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): boolean {
  const applied = applyStorePatchAtomically(patch, state);
  if (applied) {
    commitRouteApplication();
  }
  return applied;
}

function restorePreviousState(
  previous: NoteBrowserStore,
  state: NoteBrowserStateAccess,
): void {
  try {
    state.setState(previous, true);
  } catch {
    // Zustand mutates state before subscribers run, so the rollback still lands.
  }
}

function keepRenderedSurface(state: NoteBrowserStore) {
  return state.noteState.status === "ready" ||
    state.noteState.status === "missing-draft"
    ? state.noteState
    : { status: "loading" as const };
}
