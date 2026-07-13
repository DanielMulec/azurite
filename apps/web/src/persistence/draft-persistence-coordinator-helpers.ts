import type { DraftMutationSnapshot } from "./draft-workflow-types.js";
import type {
  DraftSnapshotResult,
  PreparedSlot,
  SnapshotReceipt,
} from "./draft-persistence-coordinator-types.js";

/** Creates the promise capability for one admitted snapshot. */
export function createSnapshotReceipt(): SnapshotReceipt {
  let resolveReceipt: (result: DraftSnapshotResult) => void = () => {};
  const promise = new Promise<DraftSnapshotResult>((resolve) => {
    resolveReceipt = resolve;
  });
  return { promise, resolve: resolveReceipt, settled: false };
}

/** Classifies a rejected snapshot preparation without mutating the coordinator. */
export function getPreparationRejectionReason(
  isClosed: boolean,
  isCurrent: boolean,
): "closed_epoch" | "stale_session" | undefined {
  if (isClosed) {
    return "closed_epoch";
  }
  return isCurrent ? undefined : "stale_session";
}

/** Removes and returns every slot selected by an exact-owner predicate. */
export function takeMatchingSlots<T extends PreparedSlot>(
  slots: Map<string, T>,
  predicate: (slot: PreparedSlot) => boolean,
): T[] {
  const matches = Array.from(slots).filter(([, slot]) => predicate(slot));
  matches.forEach(([key]) => {
    slots.delete(key);
  });
  return matches.map(([, slot]) => slot);
}

/** Returns whether a newer admitted snapshot supersedes a retained failure. */
export function isFailureSupersededBy(
  failed: PreparedSlot,
  current: DraftMutationSnapshot,
): boolean {
  return (
    failed.snapshot.sessionKey === current.sessionKey &&
    failed.snapshot.revision <= current.revision
  );
}

/** Notifies product state while containing subscriber failures after settlement. */
export function notifySettlement(
  slot: PreparedSlot,
  result: DraftSnapshotResult,
): void {
  try {
    slot.onSettled({ result, snapshot: slot.snapshot });
  } catch {
    // Product state already owns the operation result when a subscriber throws.
  }
}
