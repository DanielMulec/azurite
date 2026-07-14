import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { DraftFailureDetail } from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import {
  cleanupDecisionIsTerminal,
  getCleanupDecisionPatch,
} from "./note-browser-cleanup-decisions.js";
import type {
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";
import type { EditorSession } from "./note-browser-types.js";
import { StateApplicationTracker } from "./note-browser-state-application.js";

/** Retries exact browser cleanup without issuing another filesystem Save. */
export async function retryDraftCleanupAction(
  context: StoreContext,
): Promise<void> {
  const editor = getCleanupRetryEditor(context);
  if (editor === undefined) {
    return;
  }
  const target = getCleanupTarget(editor, context);
  if (target === undefined) {
    refreshCleanupIssue(editor, context);
    return;
  }
  const decision = await context.draftCoordinator.cleanupSavedSnapshot({
    ...target.snapshot,
    clusterId: target.clusterId,
  });
  applyCleanupDecision(editor.sessionKey, target.clusterId, decision, context);
}

function getCleanupRetryEditor(
  context: StoreContext,
): EditorSession | undefined {
  const noteState = context.get().noteState;
  if (noteState.status !== "ready") {
    return undefined;
  }
  const editor = noteState.editor;
  if (editor.draftDisposition !== "cleanup_required") {
    return undefined;
  }
  return hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown)
    ? undefined
    : editor;
}

function getCleanupTarget(editor: EditorSession, context: StoreContext) {
  const snapshot = context.draftCleanupRetries.get(editor.sessionKey);
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  return snapshot === undefined || clusterId === undefined
    ? undefined
    : { clusterId, snapshot };
}

function applyCleanupDecision(
  sessionKey: string,
  clusterId: string,
  decision: Awaited<
    ReturnType<StoreContext["draftCoordinator"]["cleanupSavedSnapshot"]>
  >,
  context: StoreContext,
): void {
  const tracker = new StateApplicationTracker();
  context.set((state) => {
    const editor = getCleanupOwner(state, sessionKey);
    if (editor === undefined) {
      return state;
    }
    tracker.markApplied();
    const patch = getCleanupDecisionPatch(editor, decision, clusterId);
    return patch === undefined
      ? state
      : { noteState: { editor: { ...editor, ...patch }, status: "ready" } };
  });
  if (tracker.didApply() && cleanupDecisionIsTerminal(decision)) {
    context.draftCleanupRetries.delete(sessionKey);
  }
}

function getCleanupOwner(
  state: NoteBrowserStore,
  sessionKey: string,
): EditorSession | undefined {
  if (state.noteState.status !== "ready") {
    return undefined;
  }
  const editor = state.noteState.editor;
  return editor.sessionKey === sessionKey &&
    editor.draftDisposition === "cleanup_required"
    ? editor
    : undefined;
}

function refreshCleanupIssue(
  editor: EditorSession,
  context: StoreContext,
): void {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  const failure = getCleanupRefreshFailure(clusterId, context.get());
  context.set({
    noteState: {
      editor: {
        ...editor,
        persistenceIssue: createDraftPersistenceIssue({
          clusterId,
          draftEpoch: editor.draftEpoch,
          failure,
          noteId: editor.note.id,
          operation: "cleanup",
          ownerKey: editor.sessionKey,
          retryAction: "retry_draft_cleanup",
          revision: editor.revision,
          sessionKey: editor.sessionKey,
          snapshotKey: editor.lastSnapshotKey,
        }),
      },
      status: "ready",
    },
  });
}

function getCleanupRefreshFailure(
  clusterId: string | undefined,
  state: NoteBrowserStore,
): DraftFailureDetail {
  if (clusterId !== undefined) {
    return { reason: "queue_task_failed", source: "coordinator" };
  }
  const identity = state.clusterIdentity;
  return {
    reason:
      identity?.status === "unavailable"
        ? identity.reason
        : "metadata_unavailable",
    source: "cluster_identity",
  };
}
