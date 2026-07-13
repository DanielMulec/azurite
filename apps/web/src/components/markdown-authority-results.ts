import type {
  ChangeOrigin,
  CommitCause,
  CommitResult,
  PublicationResult,
  PublicationTrigger,
  SynchronizationResult,
} from "../domain/markdown-authority-types.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";

/** Creates the no-op that clears a rejected change reverted by visible input. */
export function createRetryReverted(input: {
  readonly disposition: DraftDisposition;
  readonly origin: ChangeOrigin;
  readonly revision: number;
  readonly sessionKey: string;
  readonly trigger: PublicationTrigger;
}): PublicationResult {
  return {
    ...input,
    reason: "retry_reverted",
    stateEffect: "none",
    status: "no_change",
  };
}

/** Creates a typed commit no-op without touching editor authority. */
export function createCommitNoChange(
  cause: CommitCause,
  reason: "projection_unchanged" | "source_authority_current",
  revision: number,
  sessionKey: string,
): CommitResult {
  return { cause, reason, revision, sessionKey, status: "no_change" };
}

/** Creates a typed commit failure tied to one controller session. */
export function createCommitFailure(
  cause: CommitCause,
  reason: "projection_read_failed" | "stale_session",
  sessionKey: string,
): CommitResult {
  return { cause, reason, sessionKey, status: "failed" };
}

/** Creates a typed synchronization failure with no product-state effect. */
export function createSynchronizationFailure(
  cause: "creation" | "source_to_wysiwyg",
  reason:
    | "document_replace_failed"
    | "editor_not_ready"
    | "projection_read_failed"
    | "stale_session",
  sessionKey: string,
): SynchronizationResult {
  return { cause, reason, sessionKey, stateEffect: "none", status: "failed" };
}

/** Creates a same-mode synchronization no-op. */
export function createSynchronizationNoChange(
  sessionKey: string,
): SynchronizationResult {
  return {
    cause: "same_mode",
    sessionKey,
    stateEffect: "none",
    status: "no_change",
  };
}

/** Maps one authority publication into the same-session commit contract. */
export function toCommitResult(
  cause: CommitCause,
  sessionKey: string,
  publication: PublicationResult,
): CommitResult {
  if (publication.status === "acknowledged") {
    return { cause, publication, sessionKey, status: "acknowledged" };
  }
  if (publication.status === "no_change") {
    return {
      cause,
      reason: "projection_unchanged",
      revision: publication.revision,
      sessionKey,
      status: "no_change",
    };
  }
  return {
    cause,
    publication,
    reason: "publication_rejected",
    sessionKey,
    status: "failed",
  };
}

/** Maps a commit cause onto the exact publication trigger. */
export function toPublicationTrigger(cause: CommitCause): PublicationTrigger {
  if (cause === "mode_switch") {
    return "pre_mode_switch";
  }
  if (cause === "manual_save") {
    return "pre_save";
  }
  return cause === "route_transition" ? "pre_route_transition" : cause;
}
