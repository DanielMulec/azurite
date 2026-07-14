import type {
  DraftDeleteResult,
  DraftPersistenceUnavailableReason,
  DraftReadResult,
  DraftRecordMutationResult,
} from "./draft-database.js";
import type { DraftRecord } from "./draft-records.js";

/** Failure provenance retained after storage and queue details are classified. */
export type DraftBoundaryFailure =
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly source: "persistence";
    }
  | { readonly reason: "queue_task_failed"; readonly source: "coordinator" };

/** Caller decision from one same-note ordered browser-recovery read. */
export type OrderedDraftReadDecision =
  | {
      readonly failure:
        | Extract<DraftBoundaryFailure, { readonly source: "persistence" }>
        | undefined;
      readonly status: "absent";
    }
  | { readonly draft: DraftRecord; readonly status: "current" }
  | { readonly schemaVersion: number; readonly status: "protected" }
  | { readonly failure: DraftBoundaryFailure; readonly status: "failed" };

/** Caller decision from one ordered direct or conditional draft mutation. */
export type DraftMutationDecision =
  | {
      readonly evidence: Extract<
        DraftRecordMutationResult,
        { readonly status: "absent" | "deleted" | "invalid_deleted" }
      >;
      readonly status: "cleared";
    }
  | {
      readonly evidence: Extract<
        DraftRecordMutationResult,
        { readonly status: "not_matching" }
      >;
      readonly status: "unchanged";
    }
  | {
      readonly evidence: Extract<
        DraftRecordMutationResult,
        { readonly status: "preserved_unknown" }
      >;
      readonly schemaVersion: number;
      readonly status: "protected";
    }
  | {
      readonly evidence:
        | Extract<DraftRecordMutationResult, { readonly status: "unavailable" }>
        | undefined;
      readonly failure: DraftBoundaryFailure;
      readonly status: "failed";
    };

/** Direct-delete decision, statically excluding conditional mismatch. */
export type DraftDeleteDecision = Exclude<
  DraftMutationDecision,
  { readonly status: "unchanged" }
>;

/** Translates exact Dexie read outcomes once at the ordered boundary. */
export function decideOrderedDraftRead(
  result: DraftReadResult,
): OrderedDraftReadDecision {
  if (result.status === "found_current") {
    return { draft: result.draft, status: "current" };
  }
  if (result.status === "preserved_unknown") {
    return { schemaVersion: result.schemaVersion, status: "protected" };
  }
  if (result.status === "unavailable") {
    return {
      failure: { reason: result.reason, source: "persistence" },
      status: "failed",
    };
  }
  return {
    failure:
      result.status === "invalid_deleted"
        ? { reason: result.reason, source: "persistence" }
        : undefined,
    status: "absent",
  };
}

/** Translates exact Dexie mutation outcomes once for every workflow caller. */
export function decideDraftMutation(
  result: DraftDeleteResult,
): DraftDeleteDecision;
export function decideDraftMutation(
  result: DraftRecordMutationResult,
): DraftMutationDecision;
export function decideDraftMutation(
  result: DraftRecordMutationResult,
): DraftMutationDecision {
  if (result.status === "preserved_unknown") {
    return {
      evidence: result,
      schemaVersion: result.schemaVersion,
      status: "protected",
    };
  }
  if (result.status === "unavailable") {
    return {
      evidence: result,
      failure: { reason: result.reason, source: "persistence" },
      status: "failed",
    };
  }
  if (result.status === "not_matching") {
    return { evidence: result, status: "unchanged" };
  }
  return { evidence: result, status: "cleared" };
}
