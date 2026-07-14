import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
import type {
  DraftFailureDetail,
  DraftPersistenceIssue,
} from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
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
    refreshCleanupIssue(
      editor,
      getReadyClusterId(context.get().clusterIdentity),
      context,
    );
    return;
  }
  const result = await context.draftCoordinator.cleanupSavedSnapshot({
    ...target.snapshot,
    clusterId: target.clusterId,
  });
  applyCleanupRetryResult({
    clusterId: target.clusterId,
    context,
    result,
    sessionKey: editor.sessionKey,
  });
}

function getCleanupRetryEditor(
  context: StoreContext,
): EditorSession | undefined {
  const noteState = context.get().noteState;
  if (noteState.status !== "ready") {
    return undefined;
  }
  return getCleanCleanupEditor(noteState.editor);
}

function getCleanCleanupEditor(
  editor: EditorSession,
): EditorSession | undefined {
  if (editor.draftDisposition !== "cleanup_required") {
    return undefined;
  }
  return hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown)
    ? undefined
    : editor;
}

function getCleanupTarget(
  editor: EditorSession,
  context: StoreContext,
):
  | {
      readonly clusterId: string;
      readonly snapshot: NonNullable<
        ReturnType<StoreContext["draftCleanupRetries"]["get"]>
      >;
    }
  | undefined {
  const snapshot = context.draftCleanupRetries.get(editor.sessionKey);
  if (snapshot === undefined) {
    return undefined;
  }
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  return clusterId === undefined ? undefined : { clusterId, snapshot };
}

function applyCleanupRetryResult(input: {
  readonly clusterId: string;
  readonly context: StoreContext;
  readonly result: CoordinatedDraftMutationResult;
  readonly sessionKey: string;
}): void {
  const tracker = new StateApplicationTracker();
  input.context.set((state) => {
    const editor = getCleanupOwner(state, input.sessionKey);
    if (editor === undefined) {
      return state;
    }
    tracker.markApplied();
    const patch = getCleanupResultPatch(editor, input.result, input.clusterId);
    return patch === undefined ? state : readyPatch({ ...editor, ...patch });
  });
  if (tracker.didApply() && shouldForgetCleanupRetry(input.result)) {
    input.context.draftCleanupRetries.delete(input.sessionKey);
  }
}

function getCleanupOwner(
  state: NoteBrowserStore,
  sessionKey: string,
): EditorSession | undefined {
  if (state.noteState.status !== "ready") {
    return undefined;
  }
  return getExactCleanupEditor(state.noteState.editor, sessionKey);
}

function getExactCleanupEditor(
  editor: EditorSession,
  sessionKey: string,
): EditorSession | undefined {
  if (editor.sessionKey !== sessionKey) {
    return undefined;
  }
  return editor.draftDisposition === "cleanup_required" ? editor : undefined;
}

function getCleanupResultPatch(
  editor: EditorSession,
  result: CoordinatedDraftMutationResult,
  clusterId: string,
): Partial<EditorSession> | undefined {
  if (isDeletionComplete(result)) {
    return resolvedCleanupPatch;
  }
  if (result.status === "preserved_unknown") {
    return preservedCleanupPatch(result.schemaVersion);
  }
  return getUnresolvedCleanupPatch(editor, result, clusterId);
}

function getUnresolvedCleanupPatch(
  editor: EditorSession,
  result: Exclude<
    CoordinatedDraftMutationResult,
    {
      readonly status:
        "absent" | "deleted" | "invalid_deleted" | "preserved_unknown";
    }
  >,
  clusterId: string,
): Partial<EditorSession> | undefined {
  if (result.status === "unavailable") {
    return {
      persistenceIssue: createCleanupIssue(editor, clusterId, {
        reason: result.reason,
        source: "persistence",
      }),
    };
  }
  if (result.status === "queue_failed") {
    return {
      persistenceIssue: createCleanupIssue(editor, clusterId, {
        reason: result.reason,
        source: "coordinator",
      }),
    };
  }
  return undefined;
}

function preservedCleanupPatch(schemaVersion: number): Partial<EditorSession> {
  return {
    draftDisposition: "preserved_unknown",
    durableSnapshotKey: undefined,
    lastSnapshotKey: undefined,
    persistenceIssue: undefined,
    preservedSchemaVersion: schemaVersion,
  };
}

function shouldForgetCleanupRetry(
  result: CoordinatedDraftMutationResult,
): boolean {
  return terminalCleanupStatuses.has(result.status);
}

function refreshCleanupIssue(
  editor: EditorSession,
  clusterId: string | undefined,
  context: StoreContext,
): void {
  const identity = context.get().clusterIdentity;
  const failure = getCleanupRefreshFailure(clusterId, identity);
  context.set({
    noteState: {
      editor: {
        ...editor,
        persistenceIssue: createCleanupIssue(editor, clusterId, failure),
      },
      status: "ready",
    },
  });
}

function getCleanupRefreshFailure(
  clusterId: string | undefined,
  identity: NoteBrowserStore["clusterIdentity"],
): DraftFailureDetail {
  if (clusterId !== undefined) {
    return { reason: "queue_task_failed", source: "coordinator" };
  }
  return getUnavailableClusterFailure(identity);
}

function getUnavailableClusterFailure(
  identity: NoteBrowserStore["clusterIdentity"],
): DraftFailureDetail {
  if (identity === undefined) {
    return { reason: "metadata_unavailable", source: "cluster_identity" };
  }
  if (identity.status === "unavailable") {
    return { reason: identity.reason, source: "cluster_identity" };
  }
  return { reason: "metadata_unavailable", source: "cluster_identity" };
}

function createCleanupIssue(
  editor: EditorSession,
  clusterId: string | undefined,
  failure: DraftFailureDetail,
): DraftPersistenceIssue {
  return createDraftPersistenceIssue({
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
  });
}

function readyPatch(editor: EditorSession) {
  return { noteState: { editor, status: "ready" as const } };
}

const resolvedCleanupPatch: Partial<EditorSession> = Object.freeze({
  draftDisposition: "none",
  durableSnapshotKey: undefined,
  lastSnapshotKey: undefined,
  persistenceIssue: undefined,
  preservedSchemaVersion: undefined,
});

const terminalCleanupStatuses = new Set<
  CoordinatedDraftMutationResult["status"]
>([
  "absent",
  "deleted",
  "invalid_deleted",
  "not_matching",
  "preserved_unknown",
]);

function isDeletionComplete(
  result: CoordinatedDraftMutationResult,
): result is Extract<
  CoordinatedDraftMutationResult,
  { readonly status: "absent" | "deleted" | "invalid_deleted" }
> {
  return (
    result.status === "deleted" ||
    result.status === "absent" ||
    result.status === "invalid_deleted"
  );
}
