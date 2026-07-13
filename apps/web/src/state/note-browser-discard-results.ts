import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
import type {
  DiscardResult,
  DraftFailureDetail,
  DraftPersistenceIssue,
} from "../persistence/draft-workflow-types.js";
import type { StoreContext } from "./note-browser-contracts.js";

type DiscardIdentity = {
  readonly closedEpoch: number;
  readonly clusterId: string | undefined;
  readonly noteId: string;
  readonly ownerKey: string;
};

/** Creates the exact issue attached to a restored failed Discard surface. */
export function createDiscardIssue(
  identity: Omit<DiscardIdentity, "closedEpoch"> & {
    readonly restoredEpoch: number;
  },
  failure: DraftFailureDetail,
): DraftPersistenceIssue {
  return createDraftPersistenceIssue({
    clusterId: identity.clusterId,
    draftEpoch: identity.restoredEpoch,
    failure,
    noteId: identity.noteId,
    operation: "discard",
    ownerKey: identity.ownerKey,
    retryAction: "retry_discard",
  });
}

/** Builds a typed failure after the same surface has received a fresh epoch. */
export function createFailedDiscardResult(
  identity: DiscardIdentity & {
    readonly disposition: "conflict" | "recovered";
    readonly restoredEpoch: number;
  },
  failure: DraftFailureDetail,
  issue: DraftPersistenceIssue,
): Extract<DiscardResult, { readonly status: "failed" }> {
  return {
    ...identity,
    failure,
    issue,
    status: "failed",
    surfaceEffect: "restored",
  };
}

/** Builds a typed preservation result without exposing a future record payload. */
export function createPreservedDiscardResult(
  identity: DiscardIdentity & {
    readonly clusterId: string;
    readonly restoredEpoch: number;
    readonly schemaVersion: number;
  },
): Extract<DiscardResult, { readonly status: "preserved" }> {
  return {
    ...identity,
    disposition: "preserved_unknown",
    status: "preserved",
    surfaceEffect: "restored",
  };
}

/** Builds an owner-lost result that never mutates or reloads a newer surface. */
export function createSupersededDiscardResult(
  identity: DiscardIdentity,
): Extract<DiscardResult, { readonly status: "superseded" }> {
  return { ...identity, reason: "owner_lost", status: "superseded" };
}

/** Maps a direct or queued mutation failure without erasing its source. */
export function getDiscardMutationFailure(
  result: Exclude<
    CoordinatedDraftMutationResult,
    { readonly status: "preserved_unknown" }
  >,
): DraftFailureDetail {
  return result.status === "unavailable"
    ? { reason: result.reason, source: "persistence" }
    : { reason: "queue_task_failed", source: "coordinator" };
}

/** Returns the exact cluster-identity failure at Discard admission time. */
export function getClusterIdentityDiscardFailure(
  context: StoreContext,
): DraftFailureDetail {
  const identity = context.get().clusterIdentity;
  return {
    reason:
      identity?.status === "unavailable"
        ? identity.reason
        : "metadata_unavailable",
    source: "cluster_identity",
  };
}

/** Reports whether the transactional mutation proved that no compatible record remains. */
export function isDiscardDeletionComplete(
  result: CoordinatedDraftMutationResult,
): boolean {
  return (
    result.status === "deleted" ||
    result.status === "absent" ||
    result.status === "invalid_deleted"
  );
}
