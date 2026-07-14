import type { ClusterIdentity, NoteContentWithHash } from "@azurite/shared";

import type { DraftMutationDecision } from "../persistence/draft-persistence-decisions.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import {
  applyClusterIdentity,
  getCurrentEditorForSession,
  getReadyClusterId,
  isNoteWriteConflictError,
  isSameSaveSnapshot,
  patchSavedNoteSummary,
} from "./note-browser-action-utils.js";
import {
  cleanupDecisionIsTerminal,
  getCleanupDecisionPatch,
} from "./note-browser-cleanup-decisions.js";
import type {
  DraftWorkflowAccess,
  SnapshotKeyAllocator,
} from "./note-browser-draft-runtime.js";
import type { EditorSession } from "./note-browser-types.js";
import { admitPostSaveDraftSnapshot } from "./note-browser-save-rebase.js";

type SaveDraftWorkflow = DraftWorkflowAccess & {
  readonly allocateSnapshotKey: SnapshotKeyAllocator;
};

type SaveResponseInput = {
  readonly clusterIdentity: ClusterIdentity;
  readonly editor: EditorSession;
  readonly note: NoteContentWithHash;
  readonly workflow: SaveDraftWorkflow;
};

/** Applies a successful Save in place without overwriting newer editor truth. */
export async function applySaveResponse(
  input: SaveResponseInput,
): Promise<void> {
  const reconciliation = await reconcileSavedDraft(input);
  const currentEditor = getCurrentEditorForSession(
    input.editor,
    input.workflow.state,
  );
  if (currentEditor === undefined) {
    return;
  }
  applyClusterIdentity(input.clusterIdentity, input.workflow.state);
  input.workflow.coordinator.cancelSessionRevision(
    input.editor.sessionKey,
    input.editor.revision,
  );
  const hadNewerEdit = !isSameSaveSnapshot(currentEditor, input.editor);
  applySuccessfulSave(input, reconciliation);
  if (hadNewerEdit) {
    input.workflow.cleanupRetries.delete(input.editor.sessionKey);
    await admitPostSaveDraftSnapshot(input.workflow);
  }
}

/** Applies a failed Save to the latest exact session without restoring text. */
export function applySaveFailure(input: {
  readonly editor: EditorSession;
  readonly error: unknown;
  readonly workflow: DraftWorkflowAccess;
}): void {
  const currentEditor = getCurrentEditorForSession(
    input.editor,
    input.workflow.state,
  );
  if (currentEditor === undefined) {
    return;
  }
  input.workflow.state.setState({
    noteState: {
      editor: isNoteWriteConflictError(input.error)
        ? {
            ...currentEditor,
            draftDisposition: "conflict",
            saveStatus: "conflict",
          }
        : { ...currentEditor, saveStatus: "failed" },
      status: "ready",
    },
  });
}

function applySuccessfulSave(
  input: SaveResponseInput,
  reconciliation: DraftMutationDecision | undefined,
): void {
  input.workflow.state.setState((state) => {
    if (
      state.noteState.status !== "ready" ||
      state.noteState.editor.sessionKey !== input.editor.sessionKey
    ) {
      return state;
    }
    const editor = state.noteState.editor;
    const sameSnapshot = isSameSaveSnapshot(editor, input.editor);
    const draftPatch = getSaveDraftPatch({
      clusterIdentity: input.clusterIdentity,
      editor,
      result: reconciliation,
      sameSnapshot,
    });
    return {
      noteState: {
        editor: {
          ...editor,
          ...draftPatch,
          baseContentHash: input.note.contentHash,
          note: input.note,
          savedMarkdown: input.note.markdown,
          saveStatus: "idle",
        },
        status: "ready",
      },
      notesState: patchSavedNoteSummary(state.notesState, input.note),
    };
  });
}

type SaveDraftPatchInput = {
  readonly clusterIdentity: ClusterIdentity;
  readonly editor: EditorSession;
  readonly result: DraftMutationDecision | undefined;
  readonly sameSnapshot: boolean;
};

function getSaveDraftPatch(input: SaveDraftPatchInput): Partial<EditorSession> {
  if (isProtectedDisposition(input.editor.draftDisposition)) {
    return getProtectedSaveDraftPatch(input);
  }
  return getCompatibleSaveDraftPatch(input);
}

function getProtectedSaveDraftPatch(
  input: SaveDraftPatchInput,
): Partial<EditorSession> {
  return {
    lastSnapshotKey: input.sameSnapshot
      ? undefined
      : input.editor.lastSnapshotKey,
    persistenceIssue: getProtectedSaveIssue(input.editor),
  };
}

function getCompatibleSaveDraftPatch(
  input: SaveDraftPatchInput,
): Partial<EditorSession> {
  if (!input.sameSnapshot) {
    return getNewerEditPatch(input.editor, input.result);
  }
  if (input.result === undefined) {
    return getUntargetedCleanupPatch(input.editor, input.clusterIdentity);
  }
  return getExactCleanupPatch(
    input.editor,
    input.result,
    getReadyClusterId(input.clusterIdentity),
  );
}

function getExactCleanupPatch(
  editor: EditorSession,
  result: DraftMutationDecision,
  clusterId: string | undefined,
): Partial<EditorSession> {
  return getCleanupDecisionPatch(editor, result, clusterId) ?? {};
}

function getUntargetedCleanupPatch(
  editor: EditorSession,
  clusterIdentity: ClusterIdentity,
): Partial<EditorSession> {
  if (editor.draftDisposition === "none") {
    return resolvedDraftPatch;
  }
  if (clusterIdentity.status === "unavailable") {
    return createCleanupFailurePatch(
      editor,
      { reason: clusterIdentity.reason, source: "cluster_identity" },
      undefined,
    );
  }
  return { persistenceIssue: undefined };
}

function getNewerEditPatch(
  editor: EditorSession,
  result: DraftMutationDecision | undefined,
): Partial<EditorSession> {
  if (result?.status === "protected") {
    return {
      draftDisposition: "preserved_unknown",
      preservedSchemaVersion: result.schemaVersion,
    };
  }
  return { persistenceIssue: editor.persistenceIssue };
}

function createCleanupFailurePatch(
  editor: EditorSession,
  failure: Parameters<typeof createDraftPersistenceIssue>[0]["failure"],
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

async function reconcileSavedDraft(
  input: SaveResponseInput,
): Promise<DraftMutationDecision | undefined> {
  if (doesNotNeedSaveCleanup.has(input.editor.draftDisposition)) {
    input.workflow.cleanupRetries.delete(input.editor.sessionKey);
    return undefined;
  }
  return await reconcileCompatibleSavedDraft(input);
}

async function reconcileCompatibleSavedDraft(
  input: SaveResponseInput,
): Promise<DraftMutationDecision | undefined> {
  const snapshot = {
    baseContentHash: input.editor.baseContentHash,
    markdown: input.editor.currentMarkdown,
    noteId: input.editor.note.id,
  };
  input.workflow.cleanupRetries.remember(input.editor.sessionKey, snapshot);
  const clusterId = getReadyClusterId(input.clusterIdentity);
  if (clusterId === undefined) {
    return undefined;
  }
  const result = await input.workflow.coordinator.cleanupSavedSnapshot({
    clusterId,
    ...snapshot,
  });
  if (cleanupDecisionIsTerminal(result)) {
    input.workflow.cleanupRetries.delete(input.editor.sessionKey);
  }
  return result;
}

function getProtectedSaveIssue(
  editor: EditorSession,
): EditorSession["persistenceIssue"] {
  if (editor.draftDisposition !== "recovery_read_unavailable") {
    return undefined;
  }
  const issue = editor.persistenceIssue;
  return issue === undefined
    ? undefined
    : { ...issue, retryAction: "retry_browser_recovery" };
}

function isProtectedDisposition(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return (
    disposition === "recovery_read_unavailable" ||
    disposition === "preserved_unknown"
  );
}

const resolvedDraftPatch: Partial<EditorSession> = Object.freeze({
  draftDisposition: "none",
  durableSnapshotKey: undefined,
  lastSnapshotKey: undefined,
  persistenceIssue: undefined,
  preservedSchemaVersion: undefined,
});

const doesNotNeedSaveCleanup = new Set<EditorSession["draftDisposition"]>([
  "none",
  "preserved_unknown",
  "recovery_read_unavailable",
]);
