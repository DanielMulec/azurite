import type {
  CommitCause,
  CommitResult,
  PublicationCommand,
  PublicationResult,
  PublicationTrigger,
  SynchronizationResult,
} from "../domain/markdown-authority-types.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";
import {
  createControllerCommitNoChange,
  createCreationCheckpoint,
  createRetryReversion,
  createSourceCandidate,
  getAcceptedAuthorityPatch,
  getCheckpointProjection,
  getImmediateCommitResult,
  getWysiwygIgnoreReason,
  isCommitProjectionCurrent,
  isControllerUnavailable,
  publishRetryCandidate,
  readAuthorityProjection,
  resolveProjectionCandidate,
  toProjectionCommitResult,
  type AuthorityCheckpoint,
  type AuthorityRetryCandidate,
} from "./markdown-authority-decisions.js";
import type {
  AcceptedChangeResult,
  AuthorityControllerInput,
  MarkdownAuthorityState,
} from "./markdown-authority-controller-types.js";
import {
  callAuthorityPublication,
  createCommitFailure,
  createSynchronizationFailure,
  createSynchronizationNoChange,
  createSynchronizationSuccess,
  toPublicationTrigger,
} from "./markdown-authority-results.js";

/**
 * Owns exact Markdown authority versus Crepe's serialized projection.
 * It contains no React, route, persistence, or editor implementation state.
 */
export class MarkdownAuthorityController {
  readonly #input: AuthorityControllerInput;
  readonly #listeners = new Set<() => void>();
  #acknowledgedAuthority: string;
  #acknowledgedProjection: string | undefined;
  #checkpoint: AuthorityCheckpoint | undefined;
  #disposition: DraftDisposition;
  #frozen = false;
  #isPublishing = false;
  #isSynchronizing = false;
  #retry: AuthorityRetryCandidate | undefined;
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
    const projectionRead = readAuthorityProjection(
      this.#input.readProjection,
      () => {
        this.markFailed("The Milkdown editor projection could not be read.");
        return createSynchronizationFailure(
          "creation",
          "projection_read_failed",
          this.sessionKey,
        );
      },
    );
    if (projectionRead.status === "failed") {
      return projectionRead.result;
    }
    const projection = projectionRead.projection;
    this.#checkpoint = createCreationCheckpoint(
      {
        acknowledgedAuthority: this.#acknowledgedAuthority,
        initialMarkdown: this.#input.initialMarkdown,
        mode: this.#state.mode,
      },
      projection,
    );
    this.#acknowledgedProjection = getCheckpointProjection(this.#checkpoint);
    this.#patch({ editorError: undefined, lifecycle: "ready" });
    return createSynchronizationSuccess({
      cause: "creation",
      exactAuthority: this.#acknowledgedAuthority,
      projection,
      sessionKey: this.sessionKey,
    });
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
      createSourceCandidate(markdown),
      "direct_input",
    );
  }

  /** Classifies a ready, active Milkdown listener value. */
  publishWysiwyg(
    markdown: string,
    trigger: PublicationTrigger = "listener",
  ): AcceptedChangeResult {
    const reason = getWysiwygIgnoreReason({
      frozen: this.#frozen,
      isPublishing: this.#isPublishing,
      isSynchronizing: this.#isSynchronizing,
      lifecycle: this.#state.lifecycle,
      mode: this.#state.mode,
    });
    if (reason !== undefined) {
      return { reason, status: "ignored" };
    }
    return this.#publishCandidate(
      resolveProjectionCandidate(markdown, this.#checkpoint),
      trigger,
    );
  }

  /** Retries the exact unacknowledged visible value without another edit. */
  retryPublication(): AcceptedChangeResult | undefined {
    return publishRetryCandidate(this.#retry, (candidate) =>
      this.#publishCandidate(candidate, "explicit_retry"),
    );
  }

  /** Commits a live rich projection before a same-session or route action. */
  commit(cause: CommitCause): CommitResult {
    const immediate = getImmediateCommitResult({
      cause,
      lifecycle: this.#state.lifecycle,
      mode: this.#state.mode,
      revision: this.#revision,
      sessionKey: this.sessionKey,
    });
    if (immediate !== undefined) {
      return immediate;
    }
    const projectionRead = readAuthorityProjection(
      this.#input.readProjection,
      () =>
        createCommitFailure(cause, "projection_read_failed", this.sessionKey),
    );
    return projectionRead.status === "failed"
      ? projectionRead.result
      : this.#commitProjection(cause, projectionRead.projection);
  }

  #commitProjection(cause: CommitCause, projection: string): CommitResult {
    if (
      isCommitProjectionCurrent({
        acknowledgedProjection: this.#acknowledgedProjection,
        hasRetry: this.#retry !== undefined,
        projection,
      })
    ) {
      return createControllerCommitNoChange(
        {
          cause,
          revision: this.#revision,
          sessionKey: this.sessionKey,
        },
        "projection_unchanged",
      );
    }
    const change = this.publishWysiwyg(projection, toPublicationTrigger(cause));
    return toProjectionCommitResult(cause, this.sessionKey, change);
  }

  /** Commits WYSIWYG and activates exact source only when that commit succeeds. */
  showSource(): CommitResult {
    if (this.#state.mode === "markdown") {
      return createControllerCommitNoChange(
        {
          cause: "mode_switch",
          revision: this.#revision,
          sessionKey: this.sessionKey,
        },
        "source_authority_current",
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
    return this.#synchronizeSourceToWysiwyg();
  }

  #synchronizeSourceToWysiwyg(): SynchronizationResult {
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
      return createSynchronizationSuccess({
        cause: "source_to_wysiwyg",
        exactAuthority: this.#acknowledgedAuthority,
        projection,
        sessionKey: this.sessionKey,
      });
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
    candidate: AuthorityRetryCandidate,
    trigger: PublicationTrigger,
  ): AcceptedChangeResult {
    if (isControllerUnavailable(this.#frozen, this.#state.lifecycle)) {
      return { reason: "lifecycle", status: "ignored" };
    }
    const reverted = createRetryReversion({
      acknowledgedAuthority: this.#acknowledgedAuthority,
      candidate,
      disposition: this.#disposition,
      retry: this.#retry,
      revision: this.#revision,
      sessionKey: this.sessionKey,
      trigger,
    });
    if (reverted !== undefined) {
      this.#retry = undefined;
      this.#patch({ editorError: undefined, hasPublicationRetry: false });
      return reverted;
    }
    return this.#publishPreparedCandidate(candidate, trigger);
  }

  #publishPreparedCandidate(
    candidate: AuthorityRetryCandidate,
    trigger: PublicationTrigger,
  ): AcceptedChangeResult {
    const command: PublicationCommand = {
      markdown: candidate.markdown,
      origin: candidate.origin,
      resolution: candidate.resolution,
      sessionKey: this.sessionKey,
      trigger,
    };
    this.#isPublishing = true;
    const publication = callAuthorityPublication({
      command,
      disposition: this.#disposition,
      publish: this.#input.publish,
      revision: this.#revision,
      sessionKey: this.sessionKey,
    });
    this.#isPublishing = false;
    this.#settlePublishedCandidate(candidate, publication);
    return { markdown: candidate.markdown, publication, status: "processed" };
  }

  #settlePublishedCandidate(
    candidate: AuthorityRetryCandidate,
    publication: PublicationResult,
  ): void {
    if (publication.status === "rejected") {
      this.#retry = candidate;
      this.#patch({
        editorError: "The latest editor change has not been acknowledged.",
        hasPublicationRetry: true,
      });
      return;
    }
    this.#acceptPublication(candidate, publication);
  }

  #acceptPublication(
    candidate: AuthorityRetryCandidate,
    publication: Exclude<PublicationResult, { status: "rejected" }>,
  ): void {
    const accepted = getAcceptedAuthorityPatch(
      candidate,
      publication,
      this.#checkpoint,
    );
    this.#acknowledgedAuthority = accepted.authority;
    if (accepted.projection !== undefined) {
      this.#acknowledgedProjection = accepted.projection;
    }
    this.#revision = accepted.revision;
    this.#disposition = accepted.disposition;
    this.#retry = undefined;
    this.#patch({
      editorError: undefined,
      hasPublicationRetry: false,
      sourceMarkdown: candidate.markdown,
    });
  }

  #patch(patch: Partial<MarkdownAuthorityState>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
