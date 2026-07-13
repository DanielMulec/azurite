/** Creates the stable terminal-admission key for one owner epoch. */
export function getDraftEpochKey(ownerKey: string, draftEpoch: number): string {
  return `${ownerKey}\u0000${String(draftEpoch)}`;
}

/** Clears and releases one mutable debounce timer slot. */
export function clearDraftTimer(slot: {
  timer: ReturnType<typeof setTimeout> | undefined;
}): void {
  if (slot.timer !== undefined) {
    clearTimeout(slot.timer);
    slot.timer = undefined;
  }
}
