import type { CrepeRuntime, CrepeRuntimeFactory } from "./crepe-runtime.js";

/** Session callbacks invoked only by the currently accepted Crepe generation. */
export type CrepeGenerationCallbacks = {
  readonly markCreationFailed: (failure: unknown) => void;
  readonly markReady: (creationMarkdown: string) => boolean;
  readonly markTeardownFailed: (failure: unknown) => void;
  readonly publishMarkdown: (markdown: string) => void;
};

type GenerationOutcome =
  | { readonly status: "creation_failed" | "released" | "skipped" }
  | { readonly failure: unknown; readonly status: "teardown_failed" };

type CrepeGeneration = {
  active: boolean;
  callbacks: CrepeGenerationCallbacks | undefined;
  created: boolean;
  destroyStarted: boolean;
  host: HTMLDivElement | undefined;
  ready: boolean;
  readonly resolve: (outcome: GenerationOutcome) => void;
  runtime: CrepeRuntime | undefined;
  settled: boolean;
  readonly terminal: Promise<GenerationOutcome>;
};

/**
 * Serializes disposable Crepe generations beneath one Markdown session.
 * It owns DOM hosts and runtime references, never accepted Markdown state.
 */
export class CrepeGenerationLifecycle {
  readonly #createRuntime: CrepeRuntimeFactory;
  #current: CrepeGeneration | undefined;
  #generation = 0;
  readonly #initialMarkdown: string;
  #tail: Promise<GenerationOutcome> | undefined;

  constructor(input: {
    readonly createRuntime: CrepeRuntimeFactory;
    readonly initialMarkdown: string;
  }) {
    this.#createRuntime = input.createRuntime;
    this.#initialMarkdown = input.initialMarkdown;
  }

  /** Activates one committed generation and returns its exact retirement. */
  activate(
    container: HTMLDivElement,
    callbacks: CrepeGenerationCallbacks,
  ): () => void {
    const generation = createGeneration(callbacks);
    const predecessor = this.#tail;
    this.#tail = generation.terminal;
    this.#current = generation;
    if (predecessor === undefined) {
      this.#start(generation, container);
    } else {
      void predecessor.then((outcome) => {
        this.#startAfterPredecessor(generation, container, outcome);
      });
    }
    return () => {
      this.#retire(generation);
    };
  }

  /** Returns the ready runtime accepted by the current session generation. */
  requireCurrentRuntime(): CrepeRuntime {
    const current = this.#current;
    if (
      current === undefined ||
      !current.active ||
      !current.ready ||
      current.runtime === undefined
    ) {
      throw new Error("The Crepe runtime is not ready.");
    }
    return current.runtime;
  }

  #startAfterPredecessor(
    generation: CrepeGeneration,
    container: HTMLDivElement,
    outcome: GenerationOutcome,
  ): void {
    if (!generation.active) {
      this.#settle(generation, { status: "skipped" });
      return;
    }
    if (outcome.status === "teardown_failed") {
      this.#releaseOwnership(generation);
      generation.callbacks?.markTeardownFailed(outcome.failure);
      this.#settle(generation, outcome);
      return;
    }
    this.#start(generation, container);
  }

  #start(generation: CrepeGeneration, container: HTMLDivElement): void {
    if (!generation.active) {
      this.#settle(generation, { status: "skipped" });
      return;
    }
    const host = document.createElement("div");
    this.#generation += 1;
    host.dataset.crepeGeneration = String(this.#generation);
    generation.host = host;
    container.append(host);
    let runtime: CrepeRuntime;
    try {
      runtime = this.#createRuntime({
        initialMarkdown: this.#initialMarkdown,
        onMarkdownUpdated: (markdown) => {
          if (this.#isCurrentReady(generation)) {
            generation.callbacks?.publishMarkdown(markdown);
          }
        },
        root: host,
      });
      generation.runtime = runtime;
    } catch (failure) {
      this.#deferCreationFailure(generation, failure);
      return;
    }
    let creation: Promise<void>;
    try {
      creation = runtime.create();
    } catch (failure) {
      this.#deferCreationFailure(generation, failure);
      return;
    }
    void creation.then(
      () => {
        this.#completeCreation(generation, runtime);
      },
      (failure: unknown) => {
        this.#failCreation(generation, failure);
      },
    );
  }

  #deferCreationFailure(generation: CrepeGeneration, failure: unknown): void {
    void Promise.resolve().then(() => {
      this.#failCreation(generation, failure);
    });
  }

  #completeCreation(generation: CrepeGeneration, runtime: CrepeRuntime): void {
    generation.created = true;
    if (!generation.active || generation !== this.#current) {
      this.#destroyRetired(generation, runtime);
      return;
    }
    // The accepted generation must be synchronously readable while its
    // readiness callback validates the initial projection checkpoint.
    generation.ready = true;
    generation.ready =
      generation.callbacks?.markReady(this.#initialMarkdown) === true;
  }

  #failCreation(generation: CrepeGeneration, failure: unknown): void {
    const report = generation.active && generation === this.#current;
    this.#releaseOwnership(generation);
    if (report) {
      generation.callbacks?.markCreationFailed(failure);
    }
    this.#settle(generation, { status: "creation_failed" });
  }

  #retire(generation: CrepeGeneration): void {
    if (!generation.active) {
      return;
    }
    this.#markRetired(generation);
    this.#completeRetirement(generation);
  }

  #markRetired(generation: CrepeGeneration): void {
    generation.active = false;
    generation.ready = false;
    generation.host?.setAttribute("hidden", "");
    if (this.#current === generation) {
      this.#current = undefined;
    }
  }

  #completeRetirement(generation: CrepeGeneration): void {
    const runtime = generation.runtime;
    if (runtime === undefined) {
      if (generation.host === undefined) {
        this.#settle(generation, { status: "skipped" });
      }
      return;
    }
    if (!generation.created) {
      // Pending creation decides whether public teardown is safe to call.
      return;
    }
    this.#destroyRetired(generation, runtime);
  }

  #destroyRetired(generation: CrepeGeneration, runtime: CrepeRuntime): void {
    if (generation.destroyStarted) {
      return;
    }
    generation.destroyStarted = true;
    let teardown: Promise<void>;
    try {
      teardown = runtime.destroy();
    } catch (failure) {
      this.#finishTeardownFailure(generation, failure);
      return;
    }
    void teardown.then(
      () => {
        this.#releaseGeneration(generation);
        this.#settle(generation, { status: "released" });
      },
      (failure: unknown) => {
        this.#finishTeardownFailure(generation, failure);
      },
    );
  }

  #finishTeardownFailure(generation: CrepeGeneration, failure: unknown): void {
    this.#releaseGeneration(generation);
    this.#settle(generation, { failure, status: "teardown_failed" });
  }

  #releaseOwnership(generation: CrepeGeneration): void {
    generation.active = false;
    generation.ready = false;
    if (this.#current === generation) {
      this.#current = undefined;
    }
    this.#releaseGeneration(generation);
  }

  #releaseGeneration(generation: CrepeGeneration): void {
    generation.host?.remove();
    generation.host = undefined;
    generation.runtime = undefined;
  }

  #isCurrentReady(generation: CrepeGeneration): boolean {
    return (
      generation.active &&
      generation.ready &&
      generation === this.#current &&
      generation.runtime !== undefined
    );
  }

  #settle(generation: CrepeGeneration, outcome: GenerationOutcome): void {
    if (generation.settled) {
      return;
    }
    generation.settled = true;
    generation.callbacks = undefined;
    generation.resolve(outcome);
  }
}

function createGeneration(
  callbacks: CrepeGenerationCallbacks,
): CrepeGeneration {
  let resolveGeneration: (outcome: GenerationOutcome) => void = () => {};
  const terminal = new Promise<GenerationOutcome>((resolve) => {
    resolveGeneration = resolve;
  });
  return {
    active: true,
    callbacks,
    created: false,
    destroyStarted: false,
    host: undefined,
    ready: false,
    resolve: resolveGeneration,
    runtime: undefined,
    settled: false,
    terminal,
  };
}
