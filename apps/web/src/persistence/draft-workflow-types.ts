import type { ClusterIdentityUnavailableReason } from "@azurite/shared";

import type { DraftPersistenceUnavailableReason } from "./draft-database.js";
import type { EditorMode } from "./draft-records.js";

/** Store-owned truth about the browser record for the active note. */
export type DraftDisposition =
  | "none"
  | "generated_pending"
  | "generated_durable"
  | "recovered"
  | "conflict"
  | "cleanup_required"
  | "recovery_read_unavailable"
  | "preserved_unknown";

/** Exact reason one browser-recovery operation cannot currently complete. */
export type DraftFailureDetail =
  | {
      readonly reason: ClusterIdentityUnavailableReason;
      readonly source: "cluster_identity";
    }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly source: "persistence";
    }
  | {
      readonly reason: "queue_task_failed" | "snapshot_admission_failed";
      readonly source: "coordinator";
    }
  | {
      readonly reason: "preserved_unknown" | "recovery_read_required";
      readonly source: "record";
    };

/** Storage failures that can produce cleanup-required state. */
export type DraftStorageFailure = Extract<
  DraftFailureDetail,
  { readonly source: "coordinator" | "persistence" }
>;

/** Browser-recovery operation that owns an exact failure. */
export type DraftPersistenceOperation =
  | "recovery_read"
  | "content_write"
  | "mode_write"
  | "cleanup"
  | "discard"
  | "queue";

/** One explicit action that is valid for the matching issue. */
export type DraftRetryAction =
  | "retry_browser_recovery"
  | "retry_draft_persistence"
  | "retry_draft_cleanup"
  | "retry_discard";

/** Exact-owner failure shown separately from browser-record disposition. */
export type DraftPersistenceIssue = {
  readonly clusterId: string | undefined;
  readonly draftEpoch: number;
  readonly failure: DraftFailureDetail;
  readonly noteId: string;
  readonly operation: DraftPersistenceOperation;
  readonly ownerKey: string;
  readonly retryAction: DraftRetryAction | undefined;
  readonly revision: number | undefined;
  readonly sessionKey: string | undefined;
  readonly snapshotKey: string | undefined;
};

/** Immutable accepted-change or disposition snapshot admitted before mutation. */
export type DraftMutationSnapshot = {
  readonly baseContentHash: string;
  readonly cause:
    | "accepted_change"
    | "mode_change"
    | "generated_clean"
    | "successful_save_cleanup"
    | "cleanup_retry"
    | "discard";
  readonly clusterId: string | undefined;
  readonly contentDirty: boolean;
  readonly disposition: DraftDisposition;
  readonly draftEpoch: number;
  readonly editorMode: EditorMode;
  readonly markdown: string;
  readonly noteId: string;
  readonly revision: number;
  readonly sessionKey: string;
  readonly snapshotKey: string;
};

/** Synchronous coordinator admission result used before Zustand mutation. */
export type SnapshotPreparationResult =
  | { readonly snapshot: DraftMutationSnapshot; readonly status: "prepared" }
  | {
      readonly attemptedRevision: number;
      readonly clusterId: string | undefined;
      readonly draftEpoch: number;
      readonly noteId: string;
      readonly reason:
        "closed_epoch" | "snapshot_admission_failed" | "stale_session";
      readonly sessionKey: string;
      readonly status: "rejected";
    };

/** Exact result of a consistent browser-recovery read. */
export type RecoveryReadResult =
  | {
      readonly clusterId: string;
      readonly disposition: "none";
      readonly issue: DraftPersistenceIssue | undefined;
      readonly noteId: string;
      readonly ownerKey: string;
      readonly recordStatus: "absent" | "invalid_deleted";
      readonly status: "resolved";
    }
  | {
      readonly clusterId: string;
      readonly disposition: "conflict" | "recovered";
      readonly noteId: string;
      readonly ownerKey: string;
      readonly recordStatus: "found_current";
      readonly status: "resolved";
    }
  | {
      readonly clusterId: string;
      readonly disposition: "preserved_unknown";
      readonly noteId: string;
      readonly ownerKey: string;
      readonly schemaVersion: number;
      readonly status: "preserved";
    }
  | {
      readonly clusterId: string | undefined;
      readonly disposition: "recovery_read_unavailable";
      readonly issue: DraftPersistenceIssue;
      readonly noteId: string;
      readonly ownerKey: string;
      readonly status: "failed";
    }
  | {
      readonly clusterId: string | undefined;
      readonly noteId: string;
      readonly ownerKey: string;
      readonly reason: "dirty_live_authority" | "owner_lost";
      readonly status: "superseded";
    };

/** Exact reason an admitted snapshot cannot authorize destructive handoff. */
export type DurabilityFailure =
  | DraftFailureDetail
  | { readonly reason: "owner_lost"; readonly source: "session" };

/** Product action requesting a snapshot-specific durability decision. */
export type DurabilityCause =
  "route_transition" | "visibilitychange" | "pagehide" | "explicit_flush";

/** Snapshot-specific durability decision returned by the coordinator. */
export type DurabilityResult =
  | {
      readonly cause: DurabilityCause;
      readonly clusterId: string | undefined;
      readonly disposition: "none";
      readonly noteId: string;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string | undefined;
      readonly status: "clean";
    }
  | {
      readonly cause: DurabilityCause;
      readonly clusterId: string;
      readonly disposition: "conflict" | "generated_durable" | "recovered";
      readonly noteId: string;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string;
      readonly status: "durable";
    }
  | {
      readonly cause: DurabilityCause;
      readonly clusterId: string | undefined;
      readonly disposition: "preserved_unknown" | "recovery_read_unavailable";
      readonly noteId: string;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: undefined;
      readonly status: "preserved";
    }
  | {
      readonly cause: DurabilityCause;
      readonly clusterId: string | undefined;
      readonly disposition: DraftDisposition;
      readonly failure: DurabilityFailure;
      readonly noteId: string;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string | undefined;
      readonly status: "unavailable";
    };

/** Exact result of reconciling a compatible browser record. */
export type CleanupResult =
  | {
      readonly cause: "cleanup_retry" | "generated_clean" | "successful_save";
      readonly clusterId: string;
      readonly disposition: "none";
      readonly noteId: string;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string;
      readonly status: "completed";
      readonly storageOutcome: "absent" | "deleted" | "invalid_deleted";
    }
  | {
      readonly cause: "cleanup_retry" | "generated_clean" | "successful_save";
      readonly clusterId: string;
      readonly noteId: string;
      readonly reason: "newer_record" | "newer_revision" | "owner_lost";
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string;
      readonly status: "superseded";
    }
  | {
      readonly cause: "cleanup_retry" | "generated_clean" | "successful_save";
      readonly clusterId: string;
      readonly disposition: "preserved_unknown";
      readonly noteId: string;
      readonly revision: number;
      readonly schemaVersion: number;
      readonly sessionKey: string;
      readonly snapshotKey: string;
      readonly status: "preserved";
    }
  | {
      readonly cause: "cleanup_retry" | "generated_clean" | "successful_save";
      readonly clusterId: string;
      readonly disposition: "cleanup_required";
      readonly failure: DraftStorageFailure;
      readonly issue: DraftPersistenceIssue;
      readonly noteId: string;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string | undefined;
      readonly status: "failed";
    };
