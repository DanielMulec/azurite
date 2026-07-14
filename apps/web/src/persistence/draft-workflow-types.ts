import type { ClusterIdentityUnavailableReason } from "@azurite/shared";

import type { DraftBoundaryFailure } from "./draft-persistence-decisions.js";
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
  | DraftBoundaryFailure
  | {
      readonly reason: "snapshot_admission_failed";
      readonly source: "coordinator";
    }
  | {
      readonly reason: "preserved_unknown" | "recovery_read_required";
      readonly source: "record";
    };

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
      readonly reason: "closed_epoch" | "stale_session";
      readonly sessionKey: string;
      readonly status: "rejected";
    };

/** Product action requesting a snapshot-specific durability decision. */
export type DurabilityCause =
  | "route_transition"
  | "visibilitychange"
  | "pagehide"
  | "unmount"
  | "explicit_flush";

/** Exact reason destructive handoff cannot currently continue. */
export type HandoffFailure =
  | DraftFailureDetail
  | { readonly reason: "owner_lost"; readonly source: "session" };

/** Caller decision for route and lifecycle draft durability. */
export type HandoffDecision =
  | { readonly status: "continue" }
  | { readonly failure: HandoffFailure; readonly status: "block" };
