import type { RouteStoreApplyResult } from "../routing/route-store-executor.js";
import type { ValidatedLocationOccurrence } from "../routing/route-transition-types.js";
import type { CommittedRouteView } from "../routing/route-transition-types.js";
import { isSameHistoryOccurrence } from "../routing/validated-route-location.js";
import type {
  ActiveNoteLoad,
  NoteBrowserStore,
} from "./note-browser-contracts.js";
import type { NoteBrowserSnapshot } from "./note-browser-types.js";

/** Returns the exact live editor or missing-draft surface owner. */
export function getRenderedOwnerKey(
  snapshot: NoteBrowserSnapshot,
): string | undefined {
  if (snapshot.noteState.status === "ready") {
    return snapshot.noteState.editor.sessionKey;
  }
  return snapshot.noteState.status === "missing-draft"
    ? snapshot.noteState.renderedOwnerKey
    : undefined;
}

/** Returns a no-op only when route, selection, surface, and load all agree. */
export function getCoherentRouteView(
  input: {
    readonly activeLoad: ActiveNoteLoad | undefined;
    readonly noteId: string | undefined;
    readonly occurrence: ValidatedLocationOccurrence;
  },
  snapshot: NoteBrowserStore,
): RouteStoreApplyResult | undefined {
  const committed = getUsableCommittedView(input.activeLoad, snapshot);
  if (committed === undefined) {
    return undefined;
  }
  if (!isSameHistoryOccurrence(committed.location, input.occurrence)) {
    return undefined;
  }
  return getMatchingCommittedView(input.noteId, committed, snapshot);
}

function getUsableCommittedView(
  activeLoad: ActiveNoteLoad | undefined,
  snapshot: NoteBrowserStore,
): CommittedRouteView | undefined {
  return activeLoad === undefined ? snapshot.committedRouteView : undefined;
}

function getMatchingCommittedView(
  noteId: string | undefined,
  committed: CommittedRouteView,
  snapshot: NoteBrowserStore,
): RouteStoreApplyResult | undefined {
  if (!hasMatchingSelectedTarget(noteId, committed, snapshot)) {
    return undefined;
  }
  return matchesCommittedSurface(committed, snapshot)
    ? { status: "coherent_noop", view: committed.view }
    : undefined;
}

function hasMatchingSelectedTarget(
  noteId: string | undefined,
  committed: CommittedRouteView,
  snapshot: NoteBrowserStore,
): boolean {
  return snapshot.selectedNoteId === noteId && committed.noteId === noteId;
}

function matchesCommittedSurface(
  committed: CommittedRouteView,
  snapshot: NoteBrowserStore,
): boolean {
  if (committed.view === "ready") {
    return matchesReadySurface(committed, snapshot);
  }
  if (committed.view === "missing_draft") {
    return matchesMissingDraftSurface(committed, snapshot);
  }
  return matchesOwnerlessSurface(
    committed as Exclude<
      CommittedRouteView,
      { view: "ready" | "missing_draft" }
    >,
    snapshot,
  );
}

function matchesReadySurface(
  committed: Extract<CommittedRouteView, { view: "ready" | "missing_draft" }>,
  snapshot: NoteBrowserStore,
): boolean {
  if (snapshot.noteState.status !== "ready" || committed.view !== "ready") {
    return false;
  }
  return matchesReadyIdentity(committed, snapshot.noteState.editor);
}

function matchesReadyIdentity(
  committed: Extract<CommittedRouteView, { view: "ready" | "missing_draft" }>,
  editor: Extract<NoteBrowserStore["noteState"], { status: "ready" }>["editor"],
): boolean {
  return (
    editor.note.id === committed.noteId &&
    editor.sessionKey === committed.renderedOwnerKey
  );
}

function matchesMissingDraftSurface(
  committed: Extract<CommittedRouteView, { view: "ready" | "missing_draft" }>,
  snapshot: NoteBrowserStore,
): boolean {
  if (
    snapshot.noteState.status !== "missing-draft" ||
    committed.view !== "missing_draft"
  ) {
    return false;
  }
  return matchesMissingDraftIdentity(committed, snapshot.noteState);
}

function matchesMissingDraftIdentity(
  committed: Extract<CommittedRouteView, { view: "ready" | "missing_draft" }>,
  noteState: Extract<
    NoteBrowserStore["noteState"],
    { status: "missing-draft" }
  >,
): boolean {
  return (
    noteState.noteId === committed.noteId &&
    noteState.renderedOwnerKey === committed.renderedOwnerKey
  );
}

function matchesOwnerlessSurface(
  committed: Exclude<CommittedRouteView, { view: "ready" | "missing_draft" }>,
  snapshot: NoteBrowserStore,
): boolean {
  if (committed.view === "empty") {
    return snapshot.noteState.status === "idle";
  }
  if (committed.view === "missing") {
    return matchesTargetSurface("missing", committed.noteId, snapshot);
  }
  return matchesTargetSurface("error", committed.noteId, snapshot);
}

function matchesTargetSurface(
  status: "error" | "missing",
  noteId: string,
  snapshot: NoteBrowserStore,
): boolean {
  return (
    snapshot.noteState.status === status && snapshot.noteState.noteId === noteId
  );
}
