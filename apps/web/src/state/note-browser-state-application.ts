/** Tracks whether an exact Zustand updater applied before subscribers ran. */
export class StateApplicationTracker {
  #applied = false;

  /** Records that the exact-owner updater selected its state patch. */
  markApplied(): void {
    this.#applied = true;
  }

  /** Returns whether the exact state patch owns the store revision. */
  didApply(): boolean {
    return this.#applied;
  }
}
