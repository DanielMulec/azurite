import type {
  DraftFailureDetail,
  DraftPersistenceIssue,
  DraftPersistenceOperation,
  DraftRetryAction,
} from "./draft-workflow-types.js";

/** Creates one immutable exact-owner browser-persistence issue. */
export function createDraftPersistenceIssue(input: {
  readonly clusterId: string | undefined;
  readonly draftEpoch: number;
  readonly failure: DraftFailureDetail;
  readonly noteId: string;
  readonly operation: DraftPersistenceOperation;
  readonly ownerKey: string;
  readonly retryAction: DraftRetryAction | undefined;
  readonly revision?: number | undefined;
  readonly sessionKey?: string | undefined;
  readonly snapshotKey?: string | undefined;
}): DraftPersistenceIssue {
  return {
    clusterId: input.clusterId,
    draftEpoch: input.draftEpoch,
    failure: input.failure,
    noteId: input.noteId,
    operation: input.operation,
    ownerKey: input.ownerKey,
    retryAction: input.retryAction,
    revision: input.revision,
    sessionKey: input.sessionKey,
    snapshotKey: input.snapshotKey,
  };
}
