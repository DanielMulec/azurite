/**
 * Serializes asynchronous work per key while allowing different keys to run.
 * Idle keys are removed after their final queued task settles.
 */
export class KeyedTaskCoordinator {
  readonly #tails = new Map<string, Promise<void>>();

  /** Number of keys that currently own running or queued work. */
  get activeKeyCount(): number {
    return this.#tails.size;
  }

  /** Runs one task after all earlier tasks for the same key have settled. */
  async run<Result>(key: string, task: () => Promise<Result>): Promise<Result> {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#tails.set(key, tail);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.#tails.get(key) === tail) {
        this.#tails.delete(key);
      }
    }
  }
}
