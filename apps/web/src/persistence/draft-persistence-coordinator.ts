import { KeyedTaskCoordinator } from "@azurite/shared";

import type { DraftPersistence, SavedDraftSnapshot } from "./draft-database.js";
import {
  decideDraftMutation,
  decideOrderedDraftRead,
  type DraftDeleteDecision,
  type DraftMutationDecision,
  type OrderedDraftReadDecision,
} from "./draft-persistence-decisions.js";
import {
  executeDraftSnapshot,
  getDraftQueueKey,
  getSnapshotQueueKey,
} from "./draft-snapshot-execution.js";
import type {
  DraftMutationSnapshot,
  SnapshotPreparationResult,
} from "./draft-workflow-types.js";
import type {
  DraftPersistenceCoordinatorOptions,
  DraftSnapshotResult,
  PreparedSlot,
  ScheduledSlot,
  SnapshotReceipt,
  SnapshotSettlement,
} from "./draft-persistence-coordinator-types.js";
export type { DraftSnapshotResult } from "./draft-persistence-coordinator-types.js";
import {
  createSnapshotReceipt,
  getPreparationRejectionReason,
  isFailureSupersededBy,
  notifySettlement,
  takeMatchingSlots,
} from "./draft-persistence-coordinator-helpers.js";
import {
  clearDraftTimer,
  getDraftEpochKey,
} from "./draft-scheduling-helpers.js";

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

  /** Number of inactive, scheduled, unbound, or retryable snapshot slots. */
  get pendingSnapshotCount(): number {
    return (
      this.#prepared.size +
      this.#scheduled.size +
      this.#unbound.size +
      this.#failed.size
    );
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
    const receipt = createSnapshotReceipt();
    this.#removeSupersededFailures(snapshot);
    this.#receipts.set(snapshot.snapshotKey, receipt);
    this.#prepared.set(snapshot.snapshotKey, {
      ...input,
      admittedAt: new Date().toISOString(),
      receipt,
    });
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
    if (!this.#isExecutable(slot)) {
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
    const failed = this.#getRetryableSnapshot(snapshotKey);
    if (failed === undefined) {
      return { status: "superseded" };
    }
    this.#failed.delete(snapshotKey);
    const receipt = createSnapshotReceipt();
    const retried = { ...failed, receipt };
    this.#receipts.set(snapshotKey, receipt);
    this.#admitRetry(retried);
    return await receipt.promise;
  }

  /** Reads one record after all scheduled and queued same-note work. */
  async readDraft(
    clusterId: string,
    noteId: string,
  ): Promise<OrderedDraftReadDecision> {
    const key = getDraftQueueKey(clusterId, noteId);
    this.#startScheduled(key);
    try {
      const result = await this.#keyedTasks.run(
        key,
        async () => await this.#persistence.readDraft(clusterId, noteId),
      );
      return decideOrderedDraftRead(result);
    } catch {
      return { failure: queueFailure, status: "failed" };
    }
  }

  /** Conditionally reconciles a successful Save behind earlier note work. */
  async cleanupSavedSnapshot(
    snapshot: SavedDraftSnapshot,
  ): Promise<DraftMutationDecision> {
    const key = getDraftQueueKey(snapshot.clusterId, snapshot.noteId);
    this.#startScheduled(key);
    try {
      const result = await this.#keyedTasks.run(
        key,
        async () =>
          await this.#persistence.deleteDraftIfSavedSnapshotMatches(snapshot),
      );
      return decideDraftMutation(result);
    } catch {
      return { evidence: undefined, failure: queueFailure, status: "failed" };
    }
  }

  /** Closes an epoch and deletes only after earlier started note work settles. */
  async discard(input: {
    readonly clusterId: string;
    readonly draftEpoch: number;
    readonly noteId: string;
    readonly ownerKey: string;
  }): Promise<DraftDeleteDecision> {
    this.closeEpoch(input.ownerKey, input.draftEpoch);
    this.#cancelMatching(
      (slot) =>
        slot.snapshot.noteId === input.noteId &&
        slot.snapshot.sessionKey === input.ownerKey &&
        slot.snapshot.draftEpoch === input.draftEpoch,
    );
    const key = getDraftQueueKey(input.clusterId, input.noteId);
    try {
      const result = await this.#keyedTasks.run(
        key,
        async () =>
          await this.#persistence.deleteDraft(input.clusterId, input.noteId),
      );
      return decideDraftMutation(result);
    } catch {
      return { evidence: undefined, failure: queueFailure, status: "failed" };
    }
  }

  /** Permanently rejects callbacks from one owner epoch. */
  closeEpoch(ownerKey: string, draftEpoch: number): void {
    this.#closedEpochs.add(getDraftEpochKey(ownerKey, draftEpoch));
  }

  #getPreparationRejection(
    snapshot: DraftMutationSnapshot,
    isCurrent: () => boolean,
  ): Extract<SnapshotPreparationResult, { status: "rejected" }> | undefined {
    const reason = getPreparationRejectionReason(
      this.#isClosed(snapshot),
      isCurrent(),
    );
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

  #getRetryableSnapshot(snapshotKey: string): PreparedSlot | undefined {
    const slot = this.#failed.get(snapshotKey);
    return slot?.isCurrent() === true ? slot : undefined;
  }

  #admitRetry(slot: PreparedSlot): void {
    if (slot.snapshot.clusterId === undefined) {
      this.#commitUnbound(slot);
      return;
    }
    this.#schedule(slot);
    this.#startScheduled(getSnapshotQueueKey(slot.snapshot));
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
      clearDraftTimer(previous);
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
    clearDraftTimer(slot);
    void this.#keyedTasks
      .run(key, async () => await this.#execute(slot))
      .then(
        (result) => {
          this.#settle(slot, result);
        },
        () => {
          this.#settle(slot, {
            failure: queueFailure,
            status: "failed",
          });
        },
      );
  }

  async #execute(slot: PreparedSlot): Promise<DraftSnapshotResult> {
    if (!this.#isExecutable(slot)) {
      return { status: "superseded" };
    }
    return await executeDraftSnapshot(
      slot.snapshot,
      this.#persistence,
      slot.admittedAt,
    );
  }

  #settle(slot: PreparedSlot, result: DraftSnapshotResult): void {
    if (slot.receipt.settled) {
      return;
    }
    slot.receipt.settled = true;
    slot.receipt.resolve(result);
    notifySettlement(slot, result);
    this.#receipts.delete(slot.snapshot.snapshotKey);
    this.#updateFailedSnapshot(slot, result);
  }

  #cancelMatching(predicate: (slot: PreparedSlot) => boolean): void {
    const scheduled = takeMatchingSlots(this.#scheduled, predicate);
    scheduled.forEach(clearDraftTimer);
    const settling = [
      ...takeMatchingSlots(this.#prepared, predicate),
      ...scheduled,
      ...takeMatchingSlots(this.#unbound, predicate),
    ];
    settling.forEach((slot) => {
      this.#settle(slot, { status: "superseded" });
    });
    takeMatchingSlots(this.#failed, predicate);
  }

  #removeSupersededFailures(snapshot: DraftMutationSnapshot): void {
    for (const [key, slot] of this.#failed) {
      if (isFailureSupersededBy(slot, snapshot)) {
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
      getDraftEpochKey(snapshot.sessionKey, snapshot.draftEpoch),
    );
  }

  #isExecutable(slot: PreparedSlot): boolean {
    return slot.isCurrent() && !this.#isClosed(slot.snapshot);
  }

  #updateFailedSnapshot(slot: PreparedSlot, result: DraftSnapshotResult): void {
    const snapshotKey = slot.snapshot.snapshotKey;
    if (result.status === "failed" && !this.#isClosed(slot.snapshot)) {
      this.#failed.set(snapshotKey, slot);
      return;
    }
    this.#failed.delete(snapshotKey);
  }
}

const queueFailure = Object.freeze({
  reason: "queue_task_failed",
  source: "coordinator",
} as const);
