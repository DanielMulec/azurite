import type { DraftMutationDecision } from "../persistence/draft-persistence-decisions.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { EditorSession } from "./note-browser-types.js";

/** Applies the one mutation decision shared by Save cleanup and cleanup retry. */
export function getCleanupDecisionPatch(
  editor: EditorSession,
  decision: DraftMutationDecision,
  clusterId: string | undefined,
): Partial<EditorSession> | undefined {
  if (decision.status === "cleared") {
    return resolvedCleanupPatch;
  }
  if (decision.status === "protected") {
    return protectedCleanupPatch(decision.schemaVersion);
  }
  if (decision.status === "unchanged") {
    return unchangedCleanupPatch(editor);
  }
  return failedCleanupPatch(editor, decision.failure, clusterId);
}

/** Returns whether an exact cleanup obligation reached a terminal decision. */
export function cleanupDecisionIsTerminal(
  decision: DraftMutationDecision,
): boolean {
  return decision.status !== "failed";
}

function protectedCleanupPatch(schemaVersion: number): Partial<EditorSession> {
  return {
    draftDisposition: "preserved_unknown",
    durableSnapshotKey: undefined,
    lastSnapshotKey: undefined,
    persistenceIssue: undefined,
    preservedSchemaVersion: schemaVersion,
  };
}

function unchangedCleanupPatch(editor: EditorSession): Partial<EditorSession> {
  if (editor.draftDisposition !== "cleanup_required") {
    return { persistenceIssue: undefined };
  }
  return {
    draftDisposition: "generated_durable",
    durableSnapshotKey: undefined,
    lastSnapshotKey: undefined,
    persistenceIssue: undefined,
  };
}

function failedCleanupPatch(
  editor: EditorSession,
  failure: Extract<
    DraftMutationDecision,
    { readonly status: "failed" }
  >["failure"],
  clusterId: string | undefined,
): Partial<EditorSession> {
  return {
    draftDisposition: "cleanup_required",
    persistenceIssue: createDraftPersistenceIssue({
      clusterId,
      draftEpoch: editor.draftEpoch,
      failure,
      noteId: editor.note.id,
      operation: "cleanup",
      ownerKey: editor.sessionKey,
      retryAction: "retry_draft_cleanup",
      revision: editor.revision,
      sessionKey: editor.sessionKey,
      snapshotKey: editor.lastSnapshotKey,
    }),
  };
}

const resolvedCleanupPatch: Partial<EditorSession> = Object.freeze({
  draftDisposition: "none",
  durableSnapshotKey: undefined,
  lastSnapshotKey: undefined,
  persistenceIssue: undefined,
  preservedSchemaVersion: undefined,
});
