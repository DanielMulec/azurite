import type {
  CommitCause,
  PublicationCommand,
  PublicationResult,
  PublicationTrigger,
  SynchronizationResult,
} from "../domain/markdown-authority-types.js";

/** Calls the store publication boundary and types an unexpected thrown failure. */
export function callAuthorityPublication(
  command: PublicationCommand,
  publish: (command: PublicationCommand) => PublicationResult,
): PublicationResult {
  try {
    return publish(command);
  } catch {
    return { reason: "state_update_failed", status: "rejected" };
  }
}

/** Creates a synchronization failure without repeating session-owned fields. */
export function createSynchronizationFailure(
  cause: "creation" | "source_to_wysiwyg",
  reason: Extract<SynchronizationResult, { status: "failed" }>["reason"],
): SynchronizationResult {
  return { cause, reason, status: "failed" };
}

/** Maps one commit cause onto the exact publication trigger. */
export function toPublicationTrigger(cause: CommitCause): PublicationTrigger {
  return publicationTriggerByCommitCause[cause];
}

const publicationTriggerByCommitCause: Record<CommitCause, PublicationTrigger> =
  {
    manual_save: "pre_save",
    mode_switch: "pre_mode_switch",
    pagehide: "pagehide",
    route_transition: "pre_route_transition",
    unmount: "unmount",
    visibilitychange: "visibilitychange",
  };
