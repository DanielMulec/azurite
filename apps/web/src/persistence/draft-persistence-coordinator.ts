import { KeyedTaskCoordinator } from "@azurite/shared";

import type {
  DraftPersistence,
  DraftReadResult,
  DraftRecordMutationResult,
  DraftWriteResult,
  SavedDraftSnapshot,
} from "./draft-database.js";
import {
  executeDraftSnapshot,
  getDraftQueueKey,
  getSnapshotQueueKey,
} from "./draft-snapshot-execution.js";
import type {
  DraftMutationSnapshot,
  SnapshotPreparationResult,
} from "./draft-workflow-types.js";

/** Result of executing, coalescing, or blocking one immutable snapshot. */
export type DraftSnapshotResult =
  | { readonly status: "written" }
  | {
      readonly outcome: "no_record" | DraftRecordMutationResult;
      readonly status: "clean";
    }
  | { readonly schemaVersion: number; readonly status: "preserved_unknown" }
  | {
      readonly reason: Extract<
        DraftWriteResult | DraftRecordMutationResult,
        { readonly status: "unavailable" }
      >["reason"];
      readonly status: "unavailable";
    }
  | { readonly status: "superseded" }
  | { readonly status: "record_protected" };

type SnapshotSettlement = {
  readonly result: DraftSnapshotResult;
  readonly snapshot: DraftMutationSnapshot;
};

type PreparedSlot = {
  readonly isCurrent: () => boolean;
  readonly onSettled: (settlement: SnapshotSettlement) => void;
  readonly receipt: SnapshotReceipt;
  readonly snapshot: DraftMutationSnapshot;
};

type SnapshotReceipt = {
  readonly promise: Promise<DraftSnapshotResult>;
  readonly resolve: (result: DraftSnapshotResult) => void;
  settled: boolean;
};

type ScheduledSlot = PreparedSlot & {
  timer: ReturnType<typeof setTimeout> | undefined;
};

type DraftPersistenceCoordinatorOptions = {
  readonly delayMs: number;
  readonly persistence: DraftPersistence;
};

/**
 * Owns immutable draft admission, debounce coalescing, and ordered per-note work.
 * Zustand remains the product-state owner; this class is ephemeral scheduling.
 */
export class DraftPersistenceCoordinator {
  readonly #closedEpochs = new Set<string>();
  readonly #delayMs: number;
  readonly #failed = new Map<string, PreparedSlot>();
  readonly #keyedTasks = new KeyedTaskCoordinator();
  readonly #persistence: DraftPersistence;
  readonly #prepared = new Map<string, PreparedSlot>();
  readonly #receipts = new Map<string, SnapshotReceipt>();
  readonly #scheduled = new Map<string, ScheduledSlot>();
  readonly #unbound = new Map<string, PreparedSlot>();

  constructor(options: DraftPersistenceCoordinatorOptions) {
    this.#delayMs = options.delayMs;
    this.#persistence = options.persistence;
  }

  /** Number of note keys currently running or waiting for ordered work. */
  get activeKeyCount(): number {
    return this.#keyedTasks.activeKeyCount;
  }

  /** Number of identity-blocked session snapshots retained in memory. */
  get unboundSnapshotCount(): number {
    return this.#unbound.size;
  }

  /** Admits an inactive immutable snapshot before its Zustand revision applies. */
  prepareSnapshot(input: {
    readonly isCurrent: () => boolean;
    readonly onSettled: (settlement: SnapshotSettlement) => void;
    readonly snapshot: DraftMutationSnapshot;
  }): SnapshotPreparationResult {
    const snapshot = input.snapshot;
    const rejection = this.#getPreparationRejection(snapshot, input.isCurrent);
    if (rejection !== undefined) {
      return rejection;
    }
    const receipt = createReceipt();
    this.#removeSupersededFailures(snapshot);
    this.#receipts.set(snapshot.snapshotKey, receipt);
    this.#prepared.set(snapshot.snapshotKey, { ...input, receipt });
    return { snapshot, status: "prepared" };
  }

  /** Makes one prepared snapshot executable or identity-blocked exactly once. */
  commitPrepared(snapshotKey: string): void {
    const slot = this.#prepared.get(snapshotKey);
    if (slot === undefined) {
      return;
    }
    this.#prepared.delete(snapshotKey);
    if (slot.snapshot.clusterId === undefined) {
      this.#commitUnbound(slot);
      return;
    }
    this.#schedule(slot);
  }

  /** Cancels one inactive prepared snapshot without persistence work. */
  cancelPrepared(snapshotKey: string): void {
    const slot = this.#prepared.get(snapshotKey);
    if (slot === undefined) {
      return;
    }
    this.#prepared.delete(snapshotKey);
    this.#settle(slot, { status: "superseded" });
  }

  /** Binds the original immutable unbound snapshot after identity repair. */
  bindSessionCluster(sessionKey: string, clusterId: string): void {
    const slot = this.#unbound.get(sessionKey);
    if (slot === undefined) {
      return;
    }
    this.#unbound.delete(sessionKey);
    if (!slot.isCurrent() || this.#isClosed(slot.snapshot)) {
      this.#settle(slot, { status: "superseded" });
      return;
    }
    this.#schedule({
      ...slot,
      snapshot: { ...slot.snapshot, clusterId },
    });
  }

  /** Cancels every pending snapshot owned by one exact session and revision. */
  cancelSessionRevision(sessionKey: string, revision: number): void {
    this.#cancelMatching(
      (slot) =>
        slot.snapshot.sessionKey === sessionKey &&
        slot.snapshot.revision <= revision,
    );
  }

  /** Waits for the exact admitted snapshot after starting scheduled work. */
  async flushSnapshot(snapshotKey: string): Promise<DraftSnapshotResult> {
    const scheduled = this.#findScheduledBySnapshot(snapshotKey);
    if (scheduled !== undefined) {
      this.#startScheduled(getSnapshotQueueKey(scheduled.snapshot));
    }
    const receipt = this.#receipts.get(snapshotKey);
    return receipt === undefined
      ? { status: "superseded" }
      : await receipt.promise;
  }

  /** Re-admits one exact failed immutable snapshot without recapturing state. */
  async retrySnapshot(snapshotKey: string): Promise<DraftSnapshotResult> {
    const failed = this.#failed.get(snapshotKey);
    if (failed === undefined || !failed.isCurrent()) {
      return { status: "superseded" };
    }
    this.#failed.delete(snapshotKey);
    const receipt = createReceipt();
    const retried = { ...failed, receipt };
    this.#receipts.set(snapshotKey, receipt);
    if (retried.snapshot.clusterId === undefined) {
      this.#commitUnbound(retried);
      return await receipt.promise;
    }
    this.#schedule(retried);
    this.#startScheduled(getSnapshotQueueKey(retried.snapshot));
    return await receipt.promise;
  }

  /** Reads one record after all scheduled and queued same-note work. */
  async readDraft(clusterId: string, noteId: string): Promise<DraftReadResult> {
    const key = getDraftQueueKey(clusterId, noteId);
    this.#startScheduled(key);
    return await this.#keyedTasks.run(key, async () =>
      await this.#persistence.readDraft(clusterId, noteId),
    );
  }

  /** Conditionally reconciles a successful Save behind earlier note work. */
  async cleanupSavedSnapshot(
    snapshot: SavedDraftSnapshot,
  ): Promise<DraftRecordMutationResult> {
    const key = getDraftQueueKey(snapshot.clusterId, snapshot.noteId);
    this.#startScheduled(key);
    return await this.#keyedTasks.run(key, async () =>
      await this.#persistence.deleteDraftIfSavedSnapshotMatches(snapshot),
    );
  }

  /** Closes an epoch and deletes only after earlier started note work settles. */
  async discard(input: {
    readonly clusterId: string;
    readonly draftEpoch: number;
    readonly noteId: string;
    readonly ownerKey: string;
  }): Promise<DraftRecordMutationResult> {
    this.closeEpoch(input.ownerKey, input.draftEpoch);
    this.#cancelMatching(
      (slot) =>
        slot.snapshot.noteId === input.noteId &&
        slot.snapshot.sessionKey === input.ownerKey &&
        slot.snapshot.draftEpoch === input.draftEpoch,
    );
    const key = getDraftQueueKey(input.clusterId, input.noteId);
    return await this.#keyedTasks.run(key, async () =>
      await this.#persistence.deleteDraft(input.clusterId, input.noteId),
    );
  }

  /** Permanently rejects callbacks from one owner epoch. */
  closeEpoch(ownerKey: string, draftEpoch: number): void {
    this.#closedEpochs.add(getEpochKey(ownerKey, draftEpoch));
  }

  #getPreparationRejection(
    snapshot: DraftMutationSnapshot,
    isCurrent: () => boolean,
  ): Extract<SnapshotPreparationResult, { status: "rejected" }> | undefined {
    const reason = this.#isClosed(snapshot)
      ? "closed_epoch"
      : isCurrent()
        ? undefined
        : "stale_session";
    return reason === undefined
      ? undefined
      : {
          attemptedRevision: snapshot.revision,
          clusterId: snapshot.clusterId,
          draftEpoch: snapshot.draftEpoch,
          noteId: snapshot.noteId,
          reason,
          sessionKey: snapshot.sessionKey,
          status: "rejected",
        };
  }

  #commitUnbound(slot: PreparedSlot): void {
    const previous = this.#unbound.get(slot.snapshot.sessionKey);
    if (previous !== undefined) {
      this.#settle(previous, { status: "superseded" });
    }
    this.#unbound.set(slot.snapshot.sessionKey, slot);
  }

  #schedule(slot: PreparedSlot): void {
    const key = getSnapshotQueueKey(slot.snapshot);
    const previous = this.#scheduled.get(key);
    if (previous !== undefined) {
      clearScheduledTimer(previous);
      this.#settle(previous, { status: "superseded" });
    }
    const scheduled: ScheduledSlot = { ...slot, timer: undefined };
    scheduled.timer = setTimeout(() => {
      scheduled.timer = undefined;
      this.#startScheduled(key);
    }, this.#delayMs);
    this.#scheduled.set(key, scheduled);
  }

  #startScheduled(key: string): void {
    const slot = this.#scheduled.get(key);
    if (slot === undefined) {
      return;
    }
    this.#scheduled.delete(key);
    clearScheduledTimer(slot);
    void this.#keyedTasks
      .run(key, async () => await this.#execute(slot))
      .then(
        (result) => {
          this.#settle(slot, result);
        },
        () => {
          this.#settle(slot, { reason: "write_failed", status: "unavailable" });
        },
      );
  }

  async #execute(slot: PreparedSlot): Promise<DraftSnapshotResult> {
    if (!slot.isCurrent() || this.#isClosed(slot.snapshot)) {
      return { status: "superseded" };
    }
    return await executeDraftSnapshot(slot.snapshot, this.#persistence);
  }

  #settle(slot: PreparedSlot, result: DraftSnapshotResult): void {
    if (slot.receipt.settled) {
      return;
    }
    slot.receipt.settled = true;
    slot.receipt.resolve(result);
    slot.onSettled({ result, snapshot: slot.snapshot });
    this.#receipts.delete(slot.snapshot.snapshotKey);
    if (result.status === "unavailable") {
      this.#failed.set(slot.snapshot.snapshotKey, slot);
    } else {
      this.#failed.delete(slot.snapshot.snapshotKey);
    }
  }

  #cancelMatching(predicate: (slot: PreparedSlot) => boolean): void {
    for (const [key, slot] of this.#prepared) {
      if (predicate(slot)) {
        this.#prepared.delete(key);
        this.#settle(slot, { status: "superseded" });
      }
    }
    for (const [key, slot] of this.#scheduled) {
      if (predicate(slot)) {
        this.#scheduled.delete(key);
        clearScheduledTimer(slot);
        this.#settle(slot, { status: "superseded" });
      }
    }
    for (const [key, slot] of this.#unbound) {
      if (predicate(slot)) {
        this.#unbound.delete(key);
        this.#settle(slot, { status: "superseded" });
      }
    }
    for (const [key, slot] of this.#failed) {
      if (predicate(slot)) {
        this.#failed.delete(key);
      }
    }
  }

  #removeSupersededFailures(snapshot: DraftMutationSnapshot): void {
    for (const [key, slot] of this.#failed) {
      if (
        slot.snapshot.sessionKey === snapshot.sessionKey &&
        slot.snapshot.revision <= snapshot.revision
      ) {
        this.#failed.delete(key);
      }
    }
  }

  #findScheduledBySnapshot(snapshotKey: string): ScheduledSlot | undefined {
    return Array.from(this.#scheduled.values()).find(
      (slot) => slot.snapshot.snapshotKey === snapshotKey,
    );
  }

  #isClosed(snapshot: DraftMutationSnapshot): boolean {
    return this.#closedEpochs.has(
      getEpochKey(snapshot.sessionKey, snapshot.draftEpoch),
    );
  }
}

function createReceipt(): SnapshotReceipt {
  let resolveReceipt: (result: DraftSnapshotResult) => void = () => {};
  const promise = new Promise<DraftSnapshotResult>((resolve) => {
    resolveReceipt = resolve;
  });
  return { promise, resolve: resolveReceipt, settled: false };
}

function getEpochKey(ownerKey: string, draftEpoch: number): string {
  return `${ownerKey}\u0000${String(draftEpoch)}`;
}

function clearScheduledTimer(slot: ScheduledSlot): void {
  if (slot.timer !== undefined) {
    clearTimeout(slot.timer);
    slot.timer = undefined;
  }
}
