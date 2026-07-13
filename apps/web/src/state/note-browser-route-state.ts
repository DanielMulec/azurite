import type { ValidatedLocationOccurrence } from "../routing/route-transition-types.js";
import type {
  NoteBrowserStore,
  StoreContext,
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
  context: StoreContext,
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
    context,
  );
}

/** Applies and commits one missing-note surface without an editor owner. */
export function applyMissingRoute(
  input: NoteRouteIdentity,
  context: StoreContext,
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
    context,
  );
}

/** Applies and commits one recovered missing-note draft with live owner identity. */
export function applyMissingDraftRoute(
  input: NoteRouteIdentity & {
    readonly draft: MissingNoteDraft;
    readonly renderedOwnerKey: string;
  },
  context: StoreContext,
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
        draftEpoch: 0,
        noteId: input.noteId,
        persistenceIssue: undefined,
        renderedOwnerKey: input.renderedOwnerKey,
        status: "missing-draft",
      },
      routeHistoryStatus: { status: "available" },
      selectedNoteId: input.noteId,
    },
    context,
  );
}

/** Applies and commits one target-owned note-read error surface. */
export function applyErrorRoute(
  input: NoteRouteIdentity & { readonly message: string },
  context: StoreContext,
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
    context,
  );
}

/** Applies and commits the explicit empty-cluster route surface. */
export function applyEmptyRoute(
  location: ValidatedLocationOccurrence,
  context: StoreContext,
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
    context,
  );
}

/** Selects a current target while retaining an outgoing rendered projection. */
export function applyPendingRouteSelection(
  noteId: string,
  context: StoreContext,
): boolean {
  return applyStorePatchAtomically(
    (state) => ({
      noteState: keepRenderedSurface(state),
      selectedNoteId: noteId,
    }),
    context,
  );
}

/** Applies one state mutation and restores the exact snapshot after a throw. */
export function applyStorePatchAtomically(
  patch: RouteStatePatch,
  context: StoreContext,
): boolean {
  const previous = context.get();
  try {
    context.set(patch);
    return true;
  } catch {
    restorePreviousState(previous, context);
    return false;
  }
}

function applyCommittedRoutePatch(
  patch: RouteStatePatch,
  context: StoreContext,
): boolean {
  const applied = applyStorePatchAtomically(patch, context);
  if (applied) {
    context.commitRouteApplication();
  }
  return applied;
}

function restorePreviousState(
  previous: NoteBrowserStore,
  context: StoreContext,
): void {
  try {
    context.set(previous, true);
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
