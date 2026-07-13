import type { MarkdownAuthorityState } from "./markdown-authority-controller-types.js";

/**
 * Publishes immutable controller view snapshots and preserves editor
 * availability failures beneath temporary publication failures.
 */
export class MarkdownAuthorityStateOwner {
  readonly #listeners = new Set<() => void>();
  #availabilityError: string | undefined;
  #snapshot: MarkdownAuthorityState;

  constructor(initial: MarkdownAuthorityState) {
    this.#snapshot = initial;
  }

  /** Current immutable state used by controller decisions. */
  get current(): MarkdownAuthorityState {
    return this.#snapshot;
  }

  /** Returns the render snapshot for React and tests. */
  getSnapshot = (): MarkdownAuthorityState => this.#snapshot;

  /** Subscribes one listener to future immutable snapshots. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Applies an ordinary controller view-state transition. */
  patch(patch: Partial<MarkdownAuthorityState>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) {
      listener();
    }
  }

  /** Records a rich-editor availability failure that source edits cannot hide. */
  setAvailabilityFailure(
    message: string,
    patch: Partial<MarkdownAuthorityState> = {},
  ): void {
    this.#availabilityError = message;
    this.patch({ ...patch, editorError: message });
  }

  /** Clears an availability failure after creation or synchronization succeeds. */
  clearAvailability(patch: Partial<MarkdownAuthorityState>): void {
    this.#availabilityError = undefined;
    this.patch({ ...patch, editorError: undefined });
  }

  /** Clears a publication failure while restoring any availability failure. */
  settlePublication(patch: Partial<MarkdownAuthorityState>): void {
    this.patch({ ...patch, editorError: this.#availabilityError });
  }

  /** Releases subscribers after this controller generation is destroyed. */
  clearListeners(): void {
    this.#listeners.clear();
  }
}
