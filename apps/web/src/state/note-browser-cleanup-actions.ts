import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";

/** Retries exact browser cleanup without issuing another filesystem Save. */
export async function retryDraftCleanupAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;
  if (
    noteState.status !== "ready" ||
    noteState.editor.draftDisposition !== "cleanup_required" ||
    hasMarkdownDifference(
      noteState.editor.currentMarkdown,
      noteState.editor.savedMarkdown,
    )
  ) {
    return;
  }
  const editor = noteState.editor;
  const snapshot = context.draftCleanupRetries.get(editor.sessionKey);
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (snapshot === undefined || clusterId === undefined) {
    refreshCleanupIssue(editor, clusterId, context);
    return;
  }
  const result = await context.draftCoordinator.cleanupSavedSnapshot({
    ...snapshot,
    clusterId,
  });
  applyCleanupRetryResult(editor.sessionKey, result, clusterId, context);
}

function applyCleanupRetryResult(
  sessionKey: string,
  result: CoordinatedDraftMutationResult,
  clusterId: string,
  context: StoreContext,
): void {
  context.set((state) => {
    if (
      state.noteState.status !== "ready" ||
      state.noteState.editor.sessionKey !== sessionKey ||
      state.noteState.editor.draftDisposition !== "cleanup_required"
    ) {
      return state;
    }
    const editor = state.noteState.editor;
    if (isDeletionComplete(result)) {
      context.draftCleanupRetries.delete(sessionKey);
      return readyPatch({
        ...editor,
        draftDisposition: "none",
        durableSnapshotKey: undefined,
        lastSnapshotKey: undefined,
        persistenceIssue: undefined,
      });
    }
    if (result.status === "preserved_unknown") {
      context.draftCleanupRetries.delete(sessionKey);
      return readyPatch({
        ...editor,
        draftDisposition: "preserved_unknown",
        persistenceIssue: undefined,
        preservedSchemaVersion: result.schemaVersion,
      });
    }
    if (result.status === "unavailable") {
      return readyPatch({
        ...editor,
        persistenceIssue: createCleanupIssue(editor, clusterId, result.reason),
      });
    }
    if (result.status === "queue_failed") {
      return readyPatch({
        ...editor,
        persistenceIssue: createDraftPersistenceIssue({
          clusterId,
          draftEpoch: editor.draftEpoch,
          failure: { reason: result.reason, source: "coordinator" },
          noteId: editor.note.id,
          operation: "cleanup",
          ownerKey: editor.sessionKey,
          retryAction: "retry_draft_cleanup",
          revision: editor.revision,
          sessionKey: editor.sessionKey,
          snapshotKey: editor.lastSnapshotKey,
        }),
      });
    }
    context.draftCleanupRetries.delete(sessionKey);
    return state;
  });
}

function refreshCleanupIssue(
  editor: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "ready" }
  >["editor"],
  clusterId: string | undefined,
  context: StoreContext,
): void {
  const identity = context.get().clusterIdentity;
  const failure =
    clusterId === undefined
      ? {
          reason:
            identity?.status === "unavailable"
              ? identity.reason
              : "metadata_unavailable",
          source: "cluster_identity" as const,
        }
      : {
          reason: "queue_task_failed" as const,
          source: "coordinator" as const,
        };
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

function createCleanupIssue(
  editor: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "ready" }
  >["editor"],
  clusterId: string,
  reason:
    | "blocked_upgrade"
    | "database_unavailable"
    | "quota_exceeded"
    | "validation_failed"
    | "write_failed",
) {
  return createDraftPersistenceIssue({
    clusterId,
    draftEpoch: editor.draftEpoch,
    failure: { reason, source: "persistence" },
    noteId: editor.note.id,
    operation: "cleanup",
    ownerKey: editor.sessionKey,
    retryAction: "retry_draft_cleanup",
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    snapshotKey: editor.lastSnapshotKey,
  });
}

function readyPatch(
  editor: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "ready" }
  >["editor"],
) {
  return { noteState: { editor, status: "ready" as const } };
}

function isDeletionComplete(result: CoordinatedDraftMutationResult): boolean {
  return (
    result.status === "deleted" ||
    result.status === "absent" ||
    result.status === "invalid_deleted"
  );
}
