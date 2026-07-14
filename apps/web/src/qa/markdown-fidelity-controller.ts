import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { EditorSession } from "../state/note-browser-types.js";
import type {
  CrepeRuntime,
  CrepeRuntimeFactory,
} from "../components/crepe-runtime.js";

/** Visible state exposed by the isolated Markdown lifecycle harness. */
export type MarkdownFidelityQaSnapshot = {
  readonly creationState: "pending" | "ready" | "rejected";
  readonly generation: number;
  readonly mode: EditorMode;
  readonly publicationCount: number;
};

/** Test-only controller for deterministic real-component creation lifecycles. */
export type MarkdownFidelityQaController = {
  readonly acknowledge: (command: PublicationCommand) => PublicationResult;
  readonly createRuntime: CrepeRuntimeFactory;
  readonly getEditorSession: () => EditorSession;
  readonly getSnapshot: () => MarkdownFidelityQaSnapshot;
  readonly readEditorSession: (sessionKey: string) => EditorSession | undefined;
  readonly rejectCreation: () => void;
  readonly resetPending: () => void;
  readonly resolveCreation: () => void;
  readonly setMode: (mode: EditorMode) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

type DeferredCreation = {
  readonly promise: Promise<void>;
  readonly reject: (error: Error) => void;
  readonly resolve: () => void;
  settled: boolean;
};

/** Creates one QA-only lifecycle state owner for the dedicated harness entry. */
export function createMarkdownFidelityQaController(): MarkdownFidelityQaController {
  return new MarkdownFidelityQaControllerRuntime();
}

class MarkdownFidelityQaControllerRuntime implements MarkdownFidelityQaController {
  readonly #listeners = new Set<() => void>();
  #creation = createDeferredCreation();
  #markdown = initialMarkdown;
  #revision = 0;
  #snapshot: MarkdownFidelityQaSnapshot = {
    creationState: "pending",
    generation: 1,
    mode: "markdown",
    publicationCount: 0,
  };

  getSnapshot = (): MarkdownFidelityQaSnapshot => this.#snapshot;

  getEditorSession = (): EditorSession => ({
    baseContentHash: "qa-base-hash",
    currentMarkdown: this.#markdown,
    draftDisposition: this.#revision === 0 ? "none" : "generated_pending",
    draftEpoch: 0,
    durableSnapshotKey: undefined,
    editorMode: this.#snapshot.mode,
    lastSnapshotKey: this.#revision === 0 ? undefined : this.#getSnapshotKey(),
    note: {
      contentHash: "qa-base-hash",
      fileName: "markdown-fidelity.md",
      id: "qa/markdown-fidelity.md",
      lastModifiedAt: "2026-07-14T00:00:00.000Z",
      markdown: initialMarkdown,
      relativePath: "qa/markdown-fidelity.md",
      sizeBytes: initialMarkdown.length,
      title: "Markdown fidelity lifecycle QA",
    },
    persistenceIssue: undefined,
    preservedSchemaVersion: undefined,
    revision: this.#revision,
    savedMarkdown: initialMarkdown,
    saveStatus: "idle",
    sessionKey: this.#getSessionKey(),
  });

  readEditorSession = (sessionKey: string): EditorSession | undefined =>
    sessionKey === this.#getSessionKey() ? this.getEditorSession() : undefined;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  createRuntime: CrepeRuntimeFactory = (input) => {
    const generation = this.#snapshot.generation;
    const creation = this.#creation;
    let projection = input.initialMarkdown;
    input.root.replaceChildren();
    const marker = document.createElement("p");
    marker.dataset.qaCrepeGeneration = String(generation);
    marker.textContent = "Controlled rich-editor projection";
    input.root.append(marker);
    return {
      create: () => creation.promise,
      destroy: () => Promise.resolve(),
      getMarkdown: () => projection,
      replaceMarkdown: (markdown) => {
        projection = markdown;
        marker.textContent = markdown;
      },
    } satisfies CrepeRuntime;
  };

  acknowledge = (command: PublicationCommand): PublicationResult => {
    if (command.sessionKey !== this.#getSessionKey()) {
      return { reason: "stale_session", status: "rejected" };
    }
    this.#revision += 1;
    this.#markdown = command.markdown;
    this.#patch({ publicationCount: this.#snapshot.publicationCount + 1 });
    return { status: "accepted" };
  };

  setMode = (mode: EditorMode): void => {
    this.#patch({ mode });
  };

  resolveCreation = (): void => {
    if (this.#snapshot.creationState !== "pending") {
      return;
    }
    this.#creation.resolve();
    this.#patch({ creationState: "ready" });
  };

  rejectCreation = (): void => {
    if (this.#snapshot.creationState !== "pending") {
      return;
    }
    this.#creation.reject(new Error("Injected QA creation rejection."));
    this.#patch({ creationState: "rejected" });
  };

  resetPending = (): void => {
    if (!this.#creation.settled) {
      this.#creation.reject(new Error("QA generation reset."));
    }
    this.#creation = createDeferredCreation();
    this.#markdown = initialMarkdown;
    this.#revision = 0;
    this.#snapshot = {
      creationState: "pending",
      generation: this.#snapshot.generation + 1,
      mode: "markdown",
      publicationCount: 0,
    };
    this.#publish();
  };

  #patch(patch: Partial<MarkdownFidelityQaSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    this.#publish();
  }

  #publish(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }

  #getSessionKey(): string {
    return `markdown-fidelity-qa:${String(this.#snapshot.generation)}`;
  }

  #getSnapshotKey(): string {
    return `${this.#getSessionKey()}:${String(this.#revision)}`;
  }
}

const initialMarkdown = "# Exact pending source\n\n- hyphen item\n";

function createDeferredCreation(): DeferredCreation {
  let rejectPromise: (error: Error) => void = () => {};
  let resolvePromise: () => void = () => {};
  const deferred: DeferredCreation = {
    promise: new Promise<void>((resolve, reject) => {
      rejectPromise = reject;
      resolvePromise = resolve;
    }),
    reject: (error) => {
      if (!deferred.settled) {
        deferred.settled = true;
        rejectPromise(error);
      }
    },
    resolve: () => {
      if (!deferred.settled) {
        deferred.settled = true;
        resolvePromise();
      }
    },
    settled: false,
  };
  return deferred;
}
