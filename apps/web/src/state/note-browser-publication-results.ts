import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";
import type { EditorSession } from "./note-browser-types.js";

/** Creates a typed publication no-op without allocating a revision. */
export function createNoChangePublication(
  command: PublicationCommand,
  editor: EditorSession,
  reason: "authority_unchanged" | "retry_reverted",
): PublicationResult {
  return {
    disposition: editor.draftDisposition,
    origin: command.origin,
    reason,
    revision: editor.revision,
    sessionKey: editor.sessionKey,
    stateEffect: "none",
    status: "no_change",
    trigger: command.trigger,
  };
}

/** Creates a typed rejected publication with no store-state effect. */
export function createRejectedPublication(
  command: PublicationCommand,
  attemptedRevision: number,
  disposition: DraftDisposition,
  reason: Extract<PublicationResult, { status: "rejected" }>["reason"],
): PublicationResult {
  return {
    attemptedMarkdown: command.markdown,
    attemptedRevision,
    disposition,
    origin: command.origin,
    reason,
    sessionKey: command.sessionKey,
    stateEffect: "none",
    status: "rejected",
    trigger: command.trigger,
  };
}
