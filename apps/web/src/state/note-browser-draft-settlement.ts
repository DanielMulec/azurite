import type { DraftSnapshotResult } from "../persistence/draft-persistence-coordinator.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { DraftBoundaryFailure } from "../persistence/draft-persistence-decisions.js";
import type {
  DraftDisposition,
  DraftMutationSnapshot,
} from "../persistence/draft-workflow-types.js";
import type {
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";
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
    return removeRecoveryRetry(editor);
  }
  if (snapshot.disposition === "preserved_unknown") {
    return undefined;
  }
  return getIdentityAdmissionIssue(snapshot, context);
}

function removeRecoveryRetry(editor: EditorSession) {
  const issue = editor.persistenceIssue;
  return issue === undefined ? undefined : { ...issue, retryAction: undefined };
}

function getIdentityAdmissionIssue(
  snapshot: DraftMutationSnapshot,
  context: StoreContext,
) {
  if (snapshot.clusterId !== undefined) {
    return undefined;
  }
  const identity = getUnavailableIdentity(context.get().clusterIdentity);
  if (identity === undefined) {
    return undefined;
  }
  return createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch: snapshot.draftEpoch,
    failure: { reason: identity.reason, source: "cluster_identity" },
    noteId: snapshot.noteId,
    operation: getSnapshotWriteOperation(snapshot),
    ownerKey: snapshot.sessionKey,
    retryAction: "retry_draft_persistence",
    revision: snapshot.revision,
    sessionKey: snapshot.sessionKey,
    snapshotKey: snapshot.snapshotKey,
  });
}

function getUnavailableIdentity(
  identity: NoteBrowserStore["clusterIdentity"],
):
  | Extract<
      NonNullable<NoteBrowserStore["clusterIdentity"]>,
      { status: "unavailable" }
    >
  | undefined {
  if (identity === undefined) {
    return undefined;
  }
  return identity.status === "unavailable" ? identity : undefined;
}

function getSnapshotWriteOperation(snapshot: DraftMutationSnapshot) {
  return snapshot.cause === "mode_change" ? "mode_write" : "content_write";
}

/** Computes disposition after an accepted exact Markdown value. */
export function getNextDraftDisposition(
  disposition: DraftDisposition,
  contentDirty: boolean,
): DraftDisposition {
  if (retainedAcceptedChangeDispositions.has(disposition)) {
    return disposition;
  }
  return contentDirty ? "generated_pending" : disposition;
}

/** Returns whether an existing compatible browser record owns mode recovery. */
export function shouldPersistDraftMode(disposition: DraftDisposition): boolean {
  return modePersistentDispositions.has(disposition);
}

function getSettlementPatch(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
  result: DraftSnapshotResult,
): Partial<EditorSession> | undefined {
  if (result.status === "superseded") {
    return undefined;
  }
  if (result.status === "protected") {
    return getProtectedSettlementPatch(result.schemaVersion);
  }
  return getActionableSettlementPatch(editor, snapshot, result);
}

function getActionableSettlementPatch(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
  result: Exclude<
    DraftSnapshotResult,
    { readonly status: "protected" | "superseded" }
  >,
): Partial<EditorSession> {
  if (result.status === "written") {
    return getWrittenSettlementPatch(editor, snapshot);
  }
  if (result.status === "failed") {
    return { persistenceIssue: createWriteIssue(snapshot, result.failure) };
  }
  return getCleanSettlementPatch();
}

function getProtectedSettlementPatch(
  schemaVersion: number | undefined,
): Partial<EditorSession> | undefined {
  return schemaVersion === undefined
    ? undefined
    : {
        draftDisposition: "preserved_unknown",
        persistenceIssue: undefined,
        preservedSchemaVersion: schemaVersion,
      };
}

function getWrittenSettlementPatch(
  editor: EditorSession,
  snapshot: DraftMutationSnapshot,
): Partial<EditorSession> {
  return {
    draftDisposition:
      editor.draftDisposition === "generated_pending"
        ? "generated_durable"
        : editor.draftDisposition,
    durableSnapshotKey: snapshot.snapshotKey,
    persistenceIssue: undefined,
  };
}

function getCleanSettlementPatch(): Partial<EditorSession> {
  return {
    draftDisposition: "none",
    durableSnapshotKey: undefined,
    persistenceIssue: undefined,
  };
}

function createWriteIssue(
  snapshot: DraftMutationSnapshot,
  failure: DraftBoundaryFailure,
) {
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

const retainedAcceptedChangeDispositions = new Set<DraftDisposition>([
  "conflict",
  "preserved_unknown",
  "recovered",
  "recovery_read_unavailable",
]);

const modePersistentDispositions = new Set<DraftDisposition>([
  "conflict",
  "generated_durable",
  "generated_pending",
  "recovered",
]);
