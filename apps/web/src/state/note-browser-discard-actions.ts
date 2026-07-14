import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
import type { DiscardResult } from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  createTargetSupersededResult,
  type DiscardTarget,
  ownsDiscardTarget,
  restoreFailedDiscard,
  restorePreservedDiscard,
} from "./note-browser-discard-restoration.js";
import {
  getClusterIdentityDiscardFailure,
  getDiscardMutationFailure,
  isDiscardDeletionComplete,
} from "./note-browser-discard-results.js";
import { reloadSelectedNoteAction } from "./note-browser-route-actions.js";
import { applyMissingRoute } from "./note-browser-route-state.js";
import type { EditorSession, NoteViewState } from "./note-browser-types.js";

type MissingDraftState = Extract<
  NoteViewState,
  { readonly status: "missing-draft" }
>;

/** An inapplicable defensive call has no terminal Discard operation to report. */
export type DiscardActionResult = DiscardResult | undefined;

/** Closes a compatible recovery epoch before restoring exact disk authority. */
export async function discardDraftAndReloadDiskVersionAction(
  context: StoreContext,
): Promise<DiscardActionResult> {
  const target = getDiscardTarget(context.get().noteState);
  return target === undefined
    ? undefined
    : await discardTarget(target, context);
}

/** Closes a compatible missing-note epoch before dismissing its recovery view. */
export async function discardMissingDraftAction(
  context: StoreContext,
): Promise<DiscardActionResult> {
  const noteState = context.get().noteState;
  if (noteState.status !== "missing-draft") {
    return undefined;
  }
  const target = getMissingDiscardTarget(noteState);
  return target === undefined
    ? undefined
    : await discardTarget(target, context);
}

function getDiscardTarget(state: NoteViewState): DiscardTarget | undefined {
  if (state.status === "ready") {
    return getEditorDiscardTarget(state.editor);
  }
  if (state.status === "missing-draft") {
    return getMissingDiscardTarget(state);
  }
  return undefined;
}

function getEditorDiscardTarget(
  editor: EditorSession,
): DiscardTarget | undefined {
  if (!isDiscardable(editor.draftDisposition)) {
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
  if (noteState.draftDisposition !== "recovered") {
    return undefined;
  }
  return {
    closedEpoch: noteState.draftEpoch,
    disposition: "recovered",
    kind: "missing",
    noteId: noteState.noteId,
    noteState,
    ownerKey: noteState.renderedOwnerKey,
  };
}

async function discardTarget(
  target: DiscardTarget,
  context: StoreContext,
): Promise<DiscardResult> {
  context.draftCoordinator.closeEpoch(target.ownerKey, target.closedEpoch);
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    return restoreFailedDiscard({
      clusterId,
      context,
      failure: getClusterIdentityDiscardFailure(context),
      target,
    });
  }
  const mutation = await context.draftCoordinator.discard({
    clusterId,
    draftEpoch: target.closedEpoch,
    noteId: target.noteId,
    ownerKey: target.ownerKey,
  });
  return await resolveDiscardMutation({ clusterId, context, mutation, target });
}

type DiscardMutationInput = {
  readonly clusterId: string;
  readonly context: StoreContext;
  readonly mutation: CoordinatedDraftMutationResult;
  readonly target: DiscardTarget;
};

async function resolveDiscardMutation(
  input: DiscardMutationInput,
): Promise<DiscardResult> {
  if (isDiscardDeletionComplete(input.mutation)) {
    return await completeDiscard(input.target, input.clusterId, input.context);
  }
  if (input.mutation.status === "preserved_unknown") {
    return restorePreservedDiscard({ ...input, mutation: input.mutation });
  }
  return restoreFailedDiscard({
    clusterId: input.clusterId,
    context: input.context,
    failure: getDiscardMutationFailure(input.mutation),
    target: input.target,
  });
}

async function completeDiscard(
  target: DiscardTarget,
  clusterId: string,
  context: StoreContext,
): Promise<DiscardResult> {
  if (!ownsDiscardTarget(target, context)) {
    return createTargetSupersededResult(target, clusterId);
  }
  await applyCompletedDiscard(target, context);
  return {
    closedEpoch: target.closedEpoch,
    clusterId,
    next: target.kind === "editor" ? "reload_disk" : "missing_without_draft",
    noteId: target.noteId,
    ownerKey: target.ownerKey,
    status: "completed",
  };
}

async function applyCompletedDiscard(
  target: DiscardTarget,
  context: StoreContext,
): Promise<void> {
  if (target.kind === "editor") {
    await reloadSelectedNoteAction(context);
    return;
  }
  applyMissingAfterDiscard(target.noteId, context);
}

function isDiscardable(
  disposition: EditorSession["draftDisposition"],
): disposition is "conflict" | "recovered" {
  return disposition === "recovered" || disposition === "conflict";
}

function applyMissingAfterDiscard(noteId: string, context: StoreContext): void {
  const location = context.get().committedRouteView?.location;
  if (location === undefined) {
    context.set({ noteState: { noteId, status: "missing" } });
    return;
  }
  applyMissingRoute({ location, noteId }, context);
}
