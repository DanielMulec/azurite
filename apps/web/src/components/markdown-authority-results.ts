import type {
  CommitCause,
  CommitResult,
  PublicationResult,
  PublicationTrigger,
} from "../domain/markdown-authority-types.js";

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
