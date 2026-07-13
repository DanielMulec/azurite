/** Tracks whether an exact Zustand updater applied before subscribers ran. */
export class StateApplicationTracker {
  #applied = false;
  #subscriberThrew = false;

  /** Records that the exact-owner updater selected its state patch. */
  markApplied(): void {
    this.#applied = true;
  }

  /** Records a subscriber throw only when it followed the applied updater. */
  recordSubscriberThrow(): void {
    this.#subscriberThrew = this.#applied;
  }

  /** Returns whether the exact state patch owns the store revision. */
  didApply(): boolean {
    return this.#applied;
  }

  /** Returns the typed publication completion after state mutation. */
  getCompletion(): "normal" | "subscriber_threw_after_apply" {
    return this.#subscriberThrew ? "subscriber_threw_after_apply" : "normal";
  }
}
