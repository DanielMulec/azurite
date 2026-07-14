import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  type DiscardTarget,
  ownsDiscardTarget,
  restoreFailedDiscard,
  restoreProtectedDiscard,
} from "./note-browser-discard-restoration.js";
import { reloadSelectedNoteAction } from "./note-browser-route-actions.js";
import { applyMissingRoute } from "./note-browser-route-state.js";
import type { EditorSession, NoteViewState } from "./note-browser-types.js";

type MissingDraftState = Extract<
  NoteViewState,
  { readonly status: "missing-draft" }
>;

/** Closes a compatible recovery epoch before restoring exact disk authority. */
export async function discardDraftAndReloadDiskVersionAction(
  context: StoreContext,
): Promise<void> {
  const target = getDiscardTarget(context.get().noteState);
  if (target !== undefined) {
    await discardTarget(target, context);
  }
}

/** Closes a compatible missing-note epoch before dismissing its recovery view. */
export async function discardMissingDraftAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;
  if (noteState.status !== "missing-draft") {
    return;
  }
  const target = getMissingDiscardTarget(noteState);
  if (target !== undefined) {
    await discardTarget(target, context);
  }
}

function getDiscardTarget(state: NoteViewState): DiscardTarget | undefined {
  if (state.status === "ready") {
    return getEditorDiscardTarget(state.editor);
  }
  return state.status === "missing-draft"
    ? getMissingDiscardTarget(state)
    : undefined;
}

function getEditorDiscardTarget(
  editor: EditorSession,
): DiscardTarget | undefined {
  if (
    editor.draftDisposition !== "recovered" &&
    editor.draftDisposition !== "conflict"
  ) {
    return undefined;
  }
  return {
    closedEpoch: editor.draftEpoch,
    disposition: editor.draftDisposition,
    editor,
    kind: "editor",
    noteId: editor.note.id,
    ownerKey: editor.sessionKey,
  };
}

function getMissingDiscardTarget(
  noteState: MissingDraftState,
): DiscardTarget | undefined {
  return noteState.draftDisposition === "recovered"
    ? {
        closedEpoch: noteState.draftEpoch,
        disposition: "recovered",
        kind: "missing",
        noteId: noteState.noteId,
        noteState,
        ownerKey: noteState.renderedOwnerKey,
      }
    : undefined;
}

async function discardTarget(
  target: DiscardTarget,
  context: StoreContext,
): Promise<void> {
  context.draftCoordinator.closeEpoch(target.ownerKey, target.closedEpoch);
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    restoreFailedDiscard({
      clusterId,
      context,
      failure: getClusterIdentityFailure(context),
      target,
    });
    return;
  }
  const decision = await context.draftCoordinator.discard({
    clusterId,
    draftEpoch: target.closedEpoch,
    noteId: target.noteId,
    ownerKey: target.ownerKey,
  });
  if (decision.status === "cleared") {
    await completeDiscard(target, context);
    return;
  }
  if (decision.status === "protected") {
    restoreProtectedDiscard({
      context,
      schemaVersion: decision.schemaVersion,
      target,
    });
    return;
  }
  restoreFailedDiscard({
    clusterId,
    context,
    failure: decision.failure,
    target,
  });
}

async function completeDiscard(
  target: DiscardTarget,
  context: StoreContext,
): Promise<void> {
  if (!ownsDiscardTarget(target, context)) {
    return;
  }
  if (target.kind === "editor") {
    await reloadSelectedNoteAction(context);
    return;
  }
  applyMissingAfterDiscard(target.noteId, context);
}

function applyMissingAfterDiscard(noteId: string, context: StoreContext): void {
  const location = context.get().committedRouteView?.location;
  if (location === undefined) {
    context.set({ noteState: { noteId, status: "missing" } });
    return;
  }
  applyMissingRoute({ location, noteId }, context);
}

function getClusterIdentityFailure(context: StoreContext) {
  const identity = context.get().clusterIdentity;
  return {
    reason:
      identity?.status === "unavailable"
        ? identity.reason
        : "metadata_unavailable",
    source: "cluster_identity" as const,
  };
}
