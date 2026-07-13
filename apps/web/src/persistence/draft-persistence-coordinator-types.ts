import type {
  DraftPersistence,
  DraftRecordMutationResult,
  DraftWriteResult,
} from "./draft-database.js";
import type { DraftMutationSnapshot } from "./draft-workflow-types.js";

/** Result of executing, coalescing, or blocking one immutable snapshot. */
export type DraftSnapshotResult =
  | { readonly status: "written" }
  | {
      readonly outcome: "no_record" | DraftRecordMutationResult;
      readonly status: "clean";
    }
  | { readonly schemaVersion: number; readonly status: "preserved_unknown" }
  | {
      readonly reason:
        | Extract<
            DraftWriteResult | DraftRecordMutationResult,
            { readonly status: "unavailable" }
          >["reason"]
        | "queue_task_failed";
      readonly status: "unavailable";
    }
  | { readonly status: "superseded" }
  | { readonly status: "record_protected" };

export type SnapshotSettlement = {
  readonly result: DraftSnapshotResult;
  readonly snapshot: DraftMutationSnapshot;
};

export type SnapshotReceipt = {
  readonly promise: Promise<DraftSnapshotResult>;
  readonly resolve: (result: DraftSnapshotResult) => void;
  settled: boolean;
};

export type PreparedSlot = {
  readonly admittedAt: string;
  readonly isCurrent: () => boolean;
  readonly onSettled: (settlement: SnapshotSettlement) => void;
  readonly receipt: SnapshotReceipt;
  readonly snapshot: DraftMutationSnapshot;
};

export type ScheduledSlot = PreparedSlot & {
  timer: ReturnType<typeof setTimeout> | undefined;
};

export type DraftPersistenceCoordinatorOptions = {
  readonly delayMs: number;
  readonly persistence: DraftPersistence;
};
