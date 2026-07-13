import type {
  AuthorityResolution,
  CommitCause,
  CommitResult,
  PublicationCommand,
  PublicationResult,
  PublicationTrigger,
  SynchronizationResult,
} from "../domain/markdown-authority-types.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";
import type {
  AcceptedChangeResult,
  AuthorityControllerInput,
  MarkdownAuthorityState,
} from "./markdown-authority-controller-types.js";
import {
  createCommitFailure,
  createCommitNoChange,
  createRetryReverted,
  createSynchronizationFailure,
  createSynchronizationNoChange,
  toCommitResult,
  toPublicationTrigger,
} from "./markdown-authority-results.js";

type Checkpoint = {
  readonly exactAuthority: string;
  readonly projection: string;
};

type RetryCandidate = {
  readonly markdown: string;
  readonly origin: "source_input" | "wysiwyg_document";
  readonly resolution: AuthorityResolution;
};

/**
 * Owns exact Markdown authority versus Crepe's serialized projection.
 * It contains no React, route, persistence, or editor implementation state.
 */
export class MarkdownAuthorityController {
  readonly #input: AuthorityControllerInput;
  readonly #listeners = new Set<() => void>();
  #acknowledgedAuthority: string;
  #acknowledgedProjection: string | undefined;
  #checkpoint: Checkpoint | undefined;
  #disposition: DraftDisposition;
  #frozen = false;
  #isPublishing = false;
  #isSynchronizing = false;
  #retry: RetryCandidate | undefined;
  #revision: number;
  #state: MarkdownAuthorityState;

  constructor(input: AuthorityControllerInput) {
    this.#input = input;
    this.#acknowledgedAuthority = input.initialMarkdown;
    this.#disposition = input.initialDisposition;
    this.#revision = input.initialRevision;
    this.#state = {
      editorError: undefined,
      hasPublicationRetry: false,
      lifecycle: "creating",
      mode: input.initialMode,
      sourceMarkdown: input.initialMarkdown,
    };
  }

  /** Exact editor-session identity owned by this controller. */
  get sessionKey(): string {
    return this.#input.sessionKey;
  }

  /** Returns the current immutable render snapshot. */
  getSnapshot = (): MarkdownAuthorityState => this.#state;

  /** Subscribes React or tests to local controller state. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Completes Crepe creation without publishing its serialized projection. */
  markReady(): SynchronizationResult {
    if (this.#state.lifecycle !== "creating") {
      return createSynchronizationFailure(
        "creation",
        "stale_session",
        this.sessionKey,
      );
    }
    let projection: string;
    try {
      projection = this.#input.readProjection();
    } catch {
      this.markFailed("The Milkdown editor projection could not be read.");
      return createSynchronizationFailure(
        "creation",
        "projection_read_failed",
        this.sessionKey,
      );
    }
    if (
      this.#state.mode === "wysiwyg" &&
      this.#acknowledgedAuthority === this.#input.initialMarkdown
    ) {
      this.#checkpoint = {
        exactAuthority: this.#acknowledgedAuthority,
        projection,
      };
      this.#acknowledgedProjection = projection;
    }
    this.#patch({ editorError: undefined, lifecycle: "ready" });
    return {
      cause: "creation",
      exactAuthority: this.#acknowledgedAuthority,
      projection,
      sessionKey: this.sessionKey,
      stateEffect: "none",
      status: "synchronized",
    };
  }

  /** Falls back to exact editable source without inventing a content change. */
  markFailed(message: string): void {
    if (this.#state.lifecycle === "destroyed") {
      return;
    }
    this.#patch({
      editorError: message,
      lifecycle: "failed",
      mode: "markdown",
    });
    this.#input.onModeChange("markdown");
  }

  /** Permanently rejects late work from this instance generation. */
  destroy(): void {
    this.#frozen = true;
    this.#patch({ lifecycle: "destroyed" });
    this.#listeners.clear();
  }

  /** Prevents accepted changes while a destructive handoff owns the surface. */
  setFrozen(frozen: boolean): void {
    this.#frozen = frozen;
  }

  /** Accepts exact textarea input before any editor serialization boundary. */
  publishSource(markdown: string): AcceptedChangeResult {
    this.#patch({ sourceMarkdown: markdown });
    return this.#publishCandidate(
      { markdown, origin: "source_input", resolution: "exact_input" },
      "direct_input",
    );
  }

  /** Classifies a ready, active Milkdown listener value. */
  publishWysiwyg(
    markdown: string,
    trigger: PublicationTrigger = "listener",
  ): AcceptedChangeResult {
    if (this.#state.lifecycle !== "ready") {
      return { reason: "lifecycle", status: "ignored" };
    }
    if (this.#state.mode !== "wysiwyg" || this.#frozen) {
      return { reason: "inactive_mode", status: "ignored" };
    }
    if (this.#isSynchronizing || this.#isPublishing) {
      return { reason: "synchronization", status: "ignored" };
    }
    return this.#publishCandidate(this.#resolveProjection(markdown), trigger);
  }

  /** Retries the exact unacknowledged visible value without another edit. */
  retryPublication(): AcceptedChangeResult | undefined {
    return this.#retry === undefined
      ? undefined
      : this.#publishCandidate(this.#retry, "explicit_retry");
  }

  /** Commits a live rich projection before a same-session or route action. */
  commit(cause: CommitCause): CommitResult {
    if (this.#state.lifecycle === "destroyed") {
      return createCommitFailure(cause, "stale_session", this.sessionKey);
    }
    if (this.#state.mode === "markdown" || this.#state.lifecycle !== "ready") {
      return createCommitNoChange(
        cause,
        "source_authority_current",
        this.#revision,
        this.sessionKey,
      );
    }
    let projection: string;
    try {
      projection = this.#input.readProjection();
    } catch {
      return createCommitFailure(
        cause,
        "projection_read_failed",
        this.sessionKey,
      );
    }
    if (
      projection === this.#acknowledgedProjection &&
      this.#retry === undefined
    ) {
      return createCommitNoChange(
        cause,
        "projection_unchanged",
        this.#revision,
        this.sessionKey,
      );
    }
    const change = this.publishWysiwyg(projection, toPublicationTrigger(cause));
    if (change.status === "ignored") {
      return createCommitFailure(cause, "stale_session", this.sessionKey);
    }
    return toCommitResult(cause, this.sessionKey, change.publication);
  }

  /** Commits WYSIWYG and activates exact source only when that commit succeeds. */
  showSource(): CommitResult {
    if (this.#state.mode === "markdown") {
      return createCommitNoChange(
        "mode_switch",
        "source_authority_current",
        this.#revision,
        this.sessionKey,
      );
    }
    const commit = this.commit("mode_switch");
    if (commit.status === "failed") {
      return commit;
    }
    this.#patch({
      mode: "markdown",
      sourceMarkdown: this.#acknowledgedAuthority,
    });
    this.#input.onModeChange("markdown");
    return commit;
  }

  /** Synchronizes exact source into ready Crepe before revealing WYSIWYG. */
  showWysiwyg(): SynchronizationResult {
    if (this.#state.mode === "wysiwyg") {
      return createSynchronizationNoChange(this.sessionKey);
    }
    if (this.#state.lifecycle !== "ready") {
      return createSynchronizationFailure(
        "source_to_wysiwyg",
        "editor_not_ready",
        this.sessionKey,
      );
    }
    this.#isSynchronizing = true;
    try {
      this.#input.replaceProjection(this.#acknowledgedAuthority);
      const projection = this.#input.readProjection();
      this.#checkpoint = {
        exactAuthority: this.#acknowledgedAuthority,
        projection,
      };
      this.#acknowledgedProjection = projection;
      this.#patch({ editorError: undefined, mode: "wysiwyg" });
      this.#input.onModeChange("wysiwyg");
      return {
        cause: "source_to_wysiwyg",
        exactAuthority: this.#acknowledgedAuthority,
        projection,
        sessionKey: this.sessionKey,
        stateEffect: "none",
        status: "synchronized",
      };
    } catch {
      this.#patch({
        editorError: "The rich editor could not apply the Markdown source.",
      });
      return createSynchronizationFailure(
        "source_to_wysiwyg",
        "document_replace_failed",
        this.sessionKey,
      );
    } finally {
      this.#isSynchronizing = false;
    }
  }

  #publishCandidate(
    candidate: RetryCandidate,
    trigger: PublicationTrigger,
  ): AcceptedChangeResult {
    if (this.#frozen || this.#state.lifecycle === "destroyed") {
      return { reason: "lifecycle", status: "ignored" };
    }
    if (candidate.markdown === this.#acknowledgedAuthority && this.#retry) {
      this.#retry = undefined;
      this.#patch({ editorError: undefined, hasPublicationRetry: false });
      return {
        markdown: candidate.markdown,
        publication: createRetryReverted({
          disposition: this.#disposition,
          origin: candidate.origin,
          revision: this.#revision,
          sessionKey: this.sessionKey,
          trigger,
        }),
        status: "processed",
      };
    }
    const command: PublicationCommand = {
      markdown: candidate.markdown,
      origin: candidate.origin,
      resolution: candidate.resolution,
      sessionKey: this.sessionKey,
      trigger,
    };
    this.#isPublishing = true;
    const publication = this.#callPublish(command);
    this.#isPublishing = false;
    if (publication.status === "rejected") {
      this.#retry = candidate;
      this.#patch({
        editorError: "The latest editor change has not been acknowledged.",
        hasPublicationRetry: true,
      });
    } else {
      this.#acceptPublication(candidate, publication);
    }
    return { markdown: candidate.markdown, publication, status: "processed" };
  }

  #callPublish(command: PublicationCommand): PublicationResult {
    try {
      return this.#input.publish(command);
    } catch {
      return {
        attemptedMarkdown: command.markdown,
        attemptedRevision: this.#revision + 1,
        disposition: this.#disposition,
        origin: command.origin,
        reason: "state_update_failed",
        sessionKey: this.sessionKey,
        stateEffect: "none",
        status: "rejected",
        trigger: command.trigger,
      };
    }
  }

  #acceptPublication(
    candidate: RetryCandidate,
    publication: Exclude<PublicationResult, { status: "rejected" }>,
  ): void {
    this.#acknowledgedAuthority = candidate.markdown;
    if (candidate.origin === "wysiwyg_document") {
      this.#acknowledgedProjection =
        candidate.resolution === "checkpoint_restore"
          ? this.#checkpoint?.projection
          : candidate.markdown;
    }
    this.#revision = publication.revision;
    this.#disposition = publication.disposition;
    this.#retry = undefined;
    this.#patch({
      editorError: undefined,
      hasPublicationRetry: false,
      sourceMarkdown: candidate.markdown,
    });
  }

  #resolveProjection(markdown: string): RetryCandidate {
    const checkpoint = this.#checkpoint;
    return checkpoint !== undefined && markdown === checkpoint.projection
      ? {
          markdown: checkpoint.exactAuthority,
          origin: "wysiwyg_document",
          resolution: "checkpoint_restore",
        }
      : {
          markdown,
          origin: "wysiwyg_document",
          resolution: "serialized_projection",
        };
  }

  #patch(patch: Partial<MarkdownAuthorityState>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
