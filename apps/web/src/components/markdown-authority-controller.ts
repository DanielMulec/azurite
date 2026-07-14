import type {
  CommitCause,
  CommitResult,
  PublicationCommand,
  PublicationTrigger,
  SynchronizationResult,
} from "../domain/markdown-authority-types.js";
import type { EditorSession } from "../state/note-browser-types.js";
import {
  createCreationCheckpoint,
  createSourceCandidate,
  getAcceptedProjection,
  getCheckpointProjection,
  getWysiwygIgnoreReason,
  isCommitProjectionCurrent,
  publishRetryCandidate,
  readAuthorityProjection,
  resolveProjectionCandidate,
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
  createSynchronizationFailure,
  toPublicationTrigger,
} from "./markdown-authority-results.js";
import { MarkdownAuthorityStateOwner } from "./markdown-authority-state-owner.js";

/**
 * Adapts exact Zustand editor authority to Crepe projection checkpoints.
 * Accepted live content is always read synchronously from the current session.
 */
export class MarkdownAuthorityController {
  readonly #input: AuthorityControllerInput;
  readonly #state: MarkdownAuthorityStateOwner;
  #acknowledgedProjection: string | undefined;
  #checkpoint: AuthorityCheckpoint | undefined;
  #isPublishing = false;
  #isSynchronizing = false;
  #retry: AuthorityRetryCandidate | undefined;

  constructor(input: AuthorityControllerInput) {
    this.#input = input;
    this.#state = new MarkdownAuthorityStateOwner({
      editorError: undefined,
      hasPublicationRetry: false,
      lifecycle: "creating",
      rejectedMarkdown: undefined,
    });
  }

  /** Exact editor-session identity owned by this controller. */
  get sessionKey(): string {
    return this.#input.sessionKey;
  }

  /** Returns the current immutable adapter view snapshot. */
  getSnapshot = (): MarkdownAuthorityState => this.#state.getSnapshot();

  /** Subscribes React or tests to local adapter state. */
  subscribe = (listener: () => void): (() => void) =>
    this.#state.subscribe(listener);

  /** Completes Crepe creation without publishing its serialized projection. */
  markReady(creationMarkdown: string): SynchronizationResult {
    if (this.#state.current.lifecycle !== "creating") {
      return createSynchronizationFailure("creation", "stale_session");
    }
    const session = this.#readSession();
    if (session === undefined) {
      return createSynchronizationFailure("creation", "stale_session");
    }
    const projectionRead = readAuthorityProjection(
      this.#input.readProjection,
      () => {
        this.markFailed("The Milkdown editor projection could not be read.");
        return createSynchronizationFailure(
          "creation",
          "projection_read_failed",
        );
      },
    );
    if (projectionRead.status === "failed") {
      return projectionRead.result;
    }
    this.#checkpoint = createCreationCheckpoint(
      {
        creationMarkdown,
        currentMarkdown: session.currentMarkdown,
        mode: session.editorMode,
      },
      projectionRead.projection,
    );
    this.#acknowledgedProjection = getCheckpointProjection(this.#checkpoint);
    this.#state.clearAvailability({ lifecycle: "ready" });
    return { cause: "creation", status: "synchronized" };
  }

  /** Falls back to exact editable source without inventing a content change. */
  markFailed(message: string): void {
    const session = this.#readSession();
    if (session === undefined) {
      return;
    }
    this.#state.setAvailabilityFailure(message, { lifecycle: "failed" });
    if (session.editorMode !== "markdown") {
      this.#input.onModeChange("markdown");
    }
  }

  /** Accepts exact textarea input before any editor serialization boundary. */
  publishSource(markdown: string): AcceptedChangeResult {
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
    const session = this.#readSession();
    if (session === undefined) {
      return { reason: "lifecycle", status: "ignored" };
    }
    const reason = getWysiwygIgnoreReason({
      frozen: this.#input.isSessionFrozen(this.sessionKey),
      isPublishing: this.#isPublishing,
      isSynchronizing: this.#isSynchronizing,
      lifecycle: this.#state.current.lifecycle,
      mode: session.editorMode,
    });
    return reason === undefined
      ? this.#publishCandidate(
          resolveProjectionCandidate(markdown, this.#checkpoint),
          trigger,
        )
      : { reason, status: "ignored" };
  }

  /** Retries the exact unacknowledged visible value without another edit. */
  retryPublication(): AcceptedChangeResult | undefined {
    return publishRetryCandidate(this.#retry, (candidate) =>
      this.#publishCandidate(candidate, "explicit_retry"),
    );
  }

  /** Retains the live rich projection before a same-session or route action. */
  commit(cause: CommitCause): CommitResult {
    const session = this.#readAvailableSession();
    if (session === undefined) {
      return { reason: "stale_session", status: "block" };
    }
    if (
      session.editorMode === "markdown" ||
      this.#state.current.lifecycle !== "ready"
    ) {
      return { status: "proceed" };
    }
    const projectionRead = readAuthorityProjection(
      this.#input.readProjection,
      (): CommitResult => ({
        reason: "projection_read_failed",
        status: "block",
      }),
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
      return { status: "proceed" };
    }
    const change = this.publishWysiwyg(projection, toPublicationTrigger(cause));
    if (change.status === "accepted") {
      return { status: "proceed" };
    }
    return change.status === "rejected"
      ? { reason: change.reason, status: "block" }
      : { reason: "stale_session", status: "block" };
  }

  /** Commits WYSIWYG and activates exact source only when that commit succeeds. */
  showSource(): CommitResult {
    const session = this.#readAvailableSession();
    if (session === undefined) {
      return { reason: "stale_session", status: "block" };
    }
    if (session.editorMode === "markdown") {
      return { status: "proceed" };
    }
    const commit = this.commit("mode_switch");
    if (commit.status === "block") {
      return commit;
    }
    if (this.#readAvailableSession() === undefined) {
      return { reason: "stale_session", status: "block" };
    }
    this.#input.onModeChange("markdown");
    return commit;
  }

  /** Synchronizes exact source into ready Crepe before revealing WYSIWYG. */
  showWysiwyg(): SynchronizationResult {
    const session = this.#readAvailableSession();
    if (session === undefined) {
      return createSynchronizationFailure("source_to_wysiwyg", "stale_session");
    }
    if (session.editorMode === "wysiwyg") {
      return { cause: "same_mode", status: "no_change" };
    }
    if (this.#state.current.lifecycle !== "ready") {
      return createSynchronizationFailure(
        "source_to_wysiwyg",
        "editor_not_ready",
      );
    }
    return this.#synchronizeSourceToWysiwyg(session.currentMarkdown);
  }

  #synchronizeSourceToWysiwyg(authority: string): SynchronizationResult {
    this.#isSynchronizing = true;
    try {
      this.#input.replaceProjection(authority);
      const projection = this.#input.readProjection();
      const session = this.#readAvailableSession();
      if (
        session === undefined ||
        session.editorMode !== "markdown" ||
        session.currentMarkdown !== authority
      ) {
        return createSynchronizationFailure(
          "source_to_wysiwyg",
          "stale_session",
        );
      }
      this.#checkpoint = { exactAuthority: authority, projection };
      this.#acknowledgedProjection = projection;
      this.#state.clearAvailability({});
      this.#input.onModeChange("wysiwyg");
      return { cause: "source_to_wysiwyg", status: "synchronized" };
    } catch {
      this.#state.setAvailabilityFailure(
        "The rich editor could not apply the Markdown source.",
      );
      return createSynchronizationFailure(
        "source_to_wysiwyg",
        "document_replace_failed",
      );
    } finally {
      this.#isSynchronizing = false;
    }
  }

  #publishCandidate(
    candidate: AuthorityRetryCandidate,
    trigger: PublicationTrigger,
  ): AcceptedChangeResult {
    const session = this.#readAvailableSession();
    if (session === undefined) {
      return { reason: "lifecycle", status: "ignored" };
    }
    if (
      this.#retry !== undefined &&
      candidate.markdown === session.currentMarkdown
    ) {
      this.#acceptCandidate(candidate);
      return { status: "accepted" };
    }
    const command: PublicationCommand = {
      markdown: candidate.markdown,
      origin: candidate.origin,
      resolution: candidate.resolution,
      sessionKey: this.sessionKey,
      trigger,
    };
    this.#isPublishing = true;
    const publication = callAuthorityPublication(command, this.#input.publish);
    this.#isPublishing = false;
    if (publication.status === "rejected") {
      this.#retry = candidate;
      this.#state.patch({
        editorError: "The latest editor change has not been acknowledged.",
        hasPublicationRetry: true,
        rejectedMarkdown: candidate.markdown,
      });
      return publication;
    }
    this.#acceptCandidate(candidate);
    return publication;
  }

  #acceptCandidate(candidate: AuthorityRetryCandidate): void {
    const projection = getAcceptedProjection(candidate, this.#checkpoint);
    if (projection !== undefined) {
      this.#acknowledgedProjection = projection;
    }
    this.#retry = undefined;
    this.#state.settlePublication({
      hasPublicationRetry: false,
      rejectedMarkdown: undefined,
    });
  }

  #readSession(): EditorSession | undefined {
    const session = this.#input.readSession(this.sessionKey);
    return session?.sessionKey === this.sessionKey ? session : undefined;
  }

  #readAvailableSession(): EditorSession | undefined {
    return this.#input.isSessionFrozen(this.sessionKey)
      ? undefined
      : this.#readSession();
  }
}
