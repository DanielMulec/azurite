import type { DraftPersistence } from "./draft-database.js";
import type { DraftBoundaryFailure } from "./draft-persistence-decisions.js";
import type { DraftMutationSnapshot } from "./draft-workflow-types.js";

/** Result of executing, coalescing, or blocking one immutable snapshot. */
export type DraftSnapshotResult =
  | { readonly status: "written" }
  | { readonly status: "cleared" }
  | { readonly schemaVersion?: number; readonly status: "protected" }
  | { readonly failure: DraftBoundaryFailure; readonly status: "failed" }
  | { readonly status: "superseded" };

/** Immutable snapshot paired with its terminal coordinator result. */
export type SnapshotSettlement = {
  readonly result: DraftSnapshotResult;
  readonly snapshot: DraftMutationSnapshot;
};

/** Promise capability used to await one exact admitted snapshot. */
export type SnapshotReceipt = {
  readonly promise: Promise<DraftSnapshotResult>;
  readonly resolve: (result: DraftSnapshotResult) => void;
  settled: boolean;
};

/** Inactive or retryable immutable snapshot owned by the coordinator. */
export type PreparedSlot = {
  readonly admittedAt: string;
  readonly isCurrent: () => boolean;
  readonly onSettled: (settlement: SnapshotSettlement) => void;
  readonly receipt: SnapshotReceipt;
  readonly snapshot: DraftMutationSnapshot;
};

/** Prepared slot waiting in the per-note debounce window. */
export type ScheduledSlot = PreparedSlot & {
  timer: ReturnType<typeof setTimeout> | undefined;
};

/** Runtime dependencies for the browser draft coordinator. */
export type DraftPersistenceCoordinatorOptions = {
  readonly delayMs: number;
  readonly persistence: DraftPersistence;
};
