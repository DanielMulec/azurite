import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { DraftPersistenceCoordinator } from "../persistence/draft-persistence-coordinator.js";
import type { NoteBrowserStateAccess } from "./note-browser-contracts.js";
import {
  type DiscardTarget,
  ownsDiscardTarget,
  restoreFailedDiscard,
  restoreProtectedDiscard,
} from "./note-browser-discard-restoration.js";
import type { EditorSession, NoteViewState } from "./note-browser-types.js";

type DiscardWorkflow = {
  readonly coordinator: DraftPersistenceCoordinator;
  readonly dismissMissingDraft: (noteId: string) => void;
  readonly reloadSelectedNote: () => Promise<unknown>;
  readonly state: NoteBrowserStateAccess;
};

type MissingDraftState = Extract<
  NoteViewState,
  { readonly status: "missing-draft" }
>;

/** Discards the compatible current draft from either recovery surface. */
export async function discardCurrentDraftAction(
  workflow: DiscardWorkflow,
): Promise<void> {
  const target = getDiscardTarget(workflow.state.getState().noteState);
  if (target !== undefined) {
    await discardTarget(target, workflow);
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
  workflow: DiscardWorkflow,
): Promise<void> {
  workflow.coordinator.closeEpoch(target.ownerKey, target.closedEpoch);
  const clusterId = getReadyClusterId(
    workflow.state.getState().clusterIdentity,
  );
  if (clusterId === undefined) {
    restoreFailedDiscard({
      clusterId,
      failure: getClusterIdentityFailure(workflow.state),
      state: workflow.state,
      target,
    });
    return;
  }
  const decision = await workflow.coordinator.discard({
    clusterId,
    draftEpoch: target.closedEpoch,
    noteId: target.noteId,
    ownerKey: target.ownerKey,
  });
  if (decision.status === "cleared") {
    await completeDiscard(target, workflow);
    return;
  }
  if (decision.status === "protected") {
    restoreProtectedDiscard({
      schemaVersion: decision.schemaVersion,
      state: workflow.state,
      target,
    });
    return;
  }
  restoreFailedDiscard({
    clusterId,
    failure: decision.failure,
    state: workflow.state,
    target,
  });
}

async function completeDiscard(
  target: DiscardTarget,
  workflow: DiscardWorkflow,
): Promise<void> {
  if (!ownsDiscardTarget(target, workflow.state)) {
    return;
  }
  if (target.kind === "editor") {
    await workflow.reloadSelectedNote();
    return;
  }
  workflow.dismissMissingDraft(target.noteId);
}

function getClusterIdentityFailure(state: NoteBrowserStateAccess) {
  const identity = state.getState().clusterIdentity;
  return {
    reason:
      identity?.status === "unavailable"
        ? identity.reason
        : "metadata_unavailable",
    source: "cluster_identity" as const,
  };
}
