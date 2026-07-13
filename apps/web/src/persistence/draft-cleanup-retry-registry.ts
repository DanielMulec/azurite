import type { SavedDraftSnapshot } from "./draft-database.js";

/** Cluster-independent immutable input retained after one Save cleanup failure. */
export type DraftCleanupRetrySnapshot = Omit<SavedDraftSnapshot, "clusterId">;

/** Ephemeral exact-session owner for retryable successful-Save cleanup. */
export class DraftCleanupRetryRegistry {
  readonly #snapshots = new Map<string, DraftCleanupRetrySnapshot>();

  /** Replaces the matching session's cleanup obligation with an exact snapshot. */
  remember(sessionKey: string, snapshot: DraftCleanupRetrySnapshot): void {
    this.#snapshots.set(sessionKey, Object.freeze({ ...snapshot }));
  }

  /** Returns the immutable obligation retained for one exact editor session. */
  get(sessionKey: string): DraftCleanupRetrySnapshot | undefined {
    return this.#snapshots.get(sessionKey);
  }

  /** Supersedes a resolved or no-longer-applicable cleanup obligation. */
  delete(sessionKey: string): void {
    this.#snapshots.delete(sessionKey);
  }
}
