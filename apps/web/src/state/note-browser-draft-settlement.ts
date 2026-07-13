import type { DraftSnapshotResult } from "../persistence/draft-persistence-coordinator.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type {
  DraftDisposition,
  DraftMutationSnapshot,
} from "../persistence/draft-workflow-types.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  editorOwnsSnapshot,
  getStateEditor,
  readyEditorPatch,
} from "./note-browser-editor-state.js";
import type { EditorSession } from "./note-browser-types.js";

/** Applies one async snapshot result only to its exact current owner. */
export function applySnapshotSettlement(
  snapshot: DraftMutationSnapshot,
  result: DraftSnapshotResult,
  context: StoreContext,
): void {
  context.set((state) => {
    const editor = getStateEditor(state);
    if (!editorOwnsSnapshot(editor, snapshot)) {
      return state;
    }
    const patch = getSettlementPatch(editor, snapshot, result);
    return patch === undefined
      ? state
      : readyEditorPatch({ ...editor, ...patch });
  });
}

/** Returns the issue established synchronously with snapshot admission. */
export function getSnapshotAdmissionIssue(
  snapshot: DraftMutationSnapshot,
  editor: EditorSession,
  context: StoreContext,
) {
  if (snapshot.disposition === "recovery_read_unavailable") {
    const issue = editor.persistenceIssue;
    return issue === undefined
      ? undefined
      : { ...issue, retryAction: undefined };
  }
  if (snapshot.disposition === "preserved_unknown") {
    return undefined;
  }
  const identity = context.get().clusterIdentity;
  if (snapshot.clusterId !== undefined || identity?.status !== "unavailable") {
    return undefined;
  }
  return createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch: snapshot.draftEpoch,
    failure: { reason: identity.reason, source: "cluster_identity" },
    noteId: snapshot.noteId,
    operation:
      snapshot.cause === "mode_change" ? "mode_write" : "content_write",
    ownerKey: snapshot.sessionKey,
    retryAction: "retry_draft_persistence",
    revision: snapshot.revision,
    sessionKey: snapshot.sessionKey,
    snapshotKey: snapshot.snapshotKey,
  });
}

/** Computes disposition after an accepted exact Markdown value. */
export function getNextDraftDisposition(
  disposition: DraftDisposition,
  contentDirty: boolean,
): DraftDisposition {
  if (
    disposition === "recovered" ||
    disposition === "conflict" ||
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  ) {
    return disposition;
  }
  return contentDirty ? "generated_pending" : disposition;
}

/** Returns whether an existing compatible browser record owns mode recovery. */
export function shouldPersistDraftMode(disposition: DraftDisposition): boolean {
  return [
    "generated_pending",
    "generated_durable",
    "recovered",
    "conflict",
  ].includes(disposition);
}

function getSettlementPatch(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
  result: DraftSnapshotResult,
): Partial<EditorSession> | undefined {
  if (result.status === "superseded" || result.status === "record_protected") {
    return undefined;
  }
  if (result.status === "written") {
    return {
      draftDisposition:
        editor.draftDisposition === "generated_pending"
          ? "generated_durable"
          : editor.draftDisposition,
      durableSnapshotKey: snapshot.snapshotKey,
      persistenceIssue: undefined,
    };
  }
  if (result.status === "preserved_unknown") {
    return {
      draftDisposition: "preserved_unknown",
      persistenceIssue: undefined,
      preservedSchemaVersion: result.schemaVersion,
    };
  }
  if (result.status === "unavailable") {
    return { persistenceIssue: createWriteIssue(snapshot, result.reason) };
  }
  if (
    result.outcome === "no_record" ||
    result.outcome.status !== "not_matching"
  ) {
    return {
      draftDisposition: "none",
      durableSnapshotKey: undefined,
      persistenceIssue: undefined,
    };
  }
  return undefined;
}

function createWriteIssue(
  snapshot: DraftMutationSnapshot,
  reason: Extract<DraftSnapshotResult, { status: "unavailable" }>["reason"],
) {
  const failure =
    reason === "queue_task_failed"
      ? { reason, source: "coordinator" as const }
      : { reason, source: "persistence" as const };
  return createDraftPersistenceIssue({
    clusterId: snapshot.clusterId,
    draftEpoch: snapshot.draftEpoch,
    failure,
    noteId: snapshot.noteId,
    operation:
      snapshot.cause === "mode_change" ? "mode_write" : "content_write",
    ownerKey: snapshot.sessionKey,
    retryAction: "retry_draft_persistence",
    revision: snapshot.revision,
    sessionKey: snapshot.sessionKey,
    snapshotKey: snapshot.snapshotKey,
  });
}
