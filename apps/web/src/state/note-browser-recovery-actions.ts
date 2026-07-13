import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { RecoveryReadResult } from "../persistence/draft-workflow-types.js";
import {
  createEditorSession,
  getReadyClusterId,
} from "./note-browser-action-utils.js";
import type {
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";
import {
  readRouteDraft,
  type RouteDraftApplication,
} from "./note-browser-route-drafts.js";
import type { EditorSession } from "./note-browser-types.js";

/** Retries an unread browser record without replacing dirty live authority. */
export async function retryBrowserRecoveryAction(
  context: StoreContext,
): Promise<RecoveryReadResult> {
  const editor = getRecoveryRetryEditor(context);
  if (editor === undefined) {
    return ownerLostResult(context);
  }
  return await retryEditorRecovery(editor, context);
}

function getRecoveryRetryEditor(
  context: StoreContext,
): EditorSession | undefined {
  const noteState = context.get().noteState;
  if (noteState.status !== "ready") {
    return undefined;
  }
  return noteState.editor.draftDisposition === "recovery_read_unavailable"
    ? noteState.editor
    : undefined;
}

async function retryEditorRecovery(
  editor: EditorSession,
  context: StoreContext,
): Promise<RecoveryReadResult> {
  if (hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown)) {
    return dirtyAuthorityResult(editor, getIssueClusterId(editor));
  }
  const identity = context.get().clusterIdentity;
  if (identity === undefined) {
    return applyUnavailableIdentity(editor, context);
  }
  return await retryRecoveryWithIdentity(editor, identity, context);
}

async function retryRecoveryWithIdentity(
  editor: EditorSession,
  identity: NonNullable<NoteBrowserStore["clusterIdentity"]>,
  context: StoreContext,
): Promise<RecoveryReadResult> {
  const application = await readRouteDraft(editor.note.id, identity, context);
  const current = getExactRecoveryEditor(editor.sessionKey, context);
  if (current === undefined) {
    return ownerLostResult(context, editor.note.id, editor.sessionKey);
  }
  if (hasMarkdownDifference(current.currentMarkdown, current.savedMarkdown)) {
    return dirtyAuthorityResult(editor, application.clusterId);
  }
  return applyRecoveryApplication(editor.sessionKey, application, context);
}

function getExactRecoveryEditor(
  ownerKey: string,
  context: StoreContext,
): EditorSession | undefined {
  const noteState = context.get().noteState;
  if (noteState.status !== "ready") {
    return undefined;
  }
  return noteState.editor.sessionKey === ownerKey
    ? noteState.editor
    : undefined;
}

function dirtyAuthorityResult(
  editor: EditorSession,
  clusterId: string | undefined,
): RecoveryReadResult {
  return {
    clusterId,
    noteId: editor.note.id,
    ownerKey: editor.sessionKey,
    reason: "dirty_live_authority",
    status: "superseded",
  };
}

function getIssueClusterId(editor: EditorSession): string | undefined {
  return editor.persistenceIssue === undefined
    ? undefined
    : editor.persistenceIssue.clusterId;
}

function applyRecoveryApplication(
  ownerKey: string,
  application: RouteDraftApplication,
  context: StoreContext,
): RecoveryReadResult {
  const state = context.get();
  if (state.noteState.status !== "ready") {
    return ownerLostResult(context);
  }
  return applyOwnedRecovery({
    application,
    context,
    editor: state.noteState.editor,
    ownerKey,
  });
}

type OwnedRecoveryInput = {
  readonly application: RouteDraftApplication;
  readonly context: StoreContext;
  readonly editor: EditorSession;
  readonly ownerKey: string;
};

function applyOwnedRecovery(input: OwnedRecoveryInput): RecoveryReadResult {
  if (input.application.disposition === "recovery_read_unavailable") {
    return applyUnavailableRecovery(input);
  }
  if (input.application.disposition === "preserved_unknown") {
    return applyPreservedRecovery(input);
  }
  return applyResolvedRecovery(input);
}

function applyUnavailableRecovery(
  input: OwnedRecoveryInput,
): RecoveryReadResult {
  const issue = createDraftPersistenceIssue({
    clusterId: input.application.clusterId,
    draftEpoch: input.editor.draftEpoch,
    failure: getRecoveryFailure(input.application),
    noteId: input.editor.note.id,
    operation: "recovery_read",
    ownerKey: input.ownerKey,
    retryAction: "retry_browser_recovery",
    sessionKey: input.ownerKey,
  });
  input.context.set((current) => {
    const editor = getOwnedStateEditor(current, input.ownerKey);
    return editor === undefined
      ? current
      : {
          ...input.application.statePatch,
          noteState: {
            editor: { ...editor, persistenceIssue: issue },
            status: "ready",
          },
        };
  });
  return {
    clusterId: input.application.clusterId,
    disposition: "recovery_read_unavailable",
    issue,
    noteId: input.editor.note.id,
    ownerKey: input.ownerKey,
    status: "failed",
  };
}

function applyPreservedRecovery(input: OwnedRecoveryInput): RecoveryReadResult {
  input.context.set((current) => {
    const editor = getOwnedStateEditor(current, input.ownerKey);
    return editor === undefined
      ? current
      : {
          noteState: {
            editor: {
              ...editor,
              draftDisposition: "preserved_unknown",
              persistenceIssue: undefined,
              preservedSchemaVersion: input.application.preservedSchemaVersion,
            },
            status: "ready",
          },
        };
  });
  return {
    clusterId: requireClusterId(input.application.clusterId),
    disposition: "preserved_unknown",
    noteId: input.editor.note.id,
    ownerKey: input.ownerKey,
    schemaVersion: input.application.preservedSchemaVersion ?? 2,
    status: "preserved",
  };
}

function applyResolvedRecovery(input: OwnedRecoveryInput): RecoveryReadResult {
  const editor = createEditorSession(
    input.editor.note,
    input.application,
    input.context,
  );
  const committed = input.context.get().committedRouteView;
  input.context.set({
    ...input.application.statePatch,
    committedRouteView: rebaseCommittedOwner(committed, editor.sessionKey),
    noteState: { editor, status: "ready" },
  });
  const clusterId = requireClusterId(input.application.clusterId);
  return input.application.draft === undefined
    ? resolvedAbsentRecovery(input, editor, clusterId)
    : resolvedCurrentRecovery(input, editor, clusterId);
}

function resolvedAbsentRecovery(
  input: OwnedRecoveryInput,
  editor: EditorSession,
  clusterId: string,
): RecoveryReadResult {
  return {
    clusterId,
    disposition: "none",
    issue: editor.persistenceIssue,
    noteId: editor.note.id,
    ownerKey: input.ownerKey,
    recordStatus: getAbsentRecordStatus(input.application),
    status: "resolved",
  };
}

function resolvedCurrentRecovery(
  input: OwnedRecoveryInput,
  editor: EditorSession,
  clusterId: string,
): RecoveryReadResult {
  return {
    clusterId,
    disposition: editor.draftDisposition as "conflict" | "recovered",
    noteId: editor.note.id,
    ownerKey: input.ownerKey,
    recordStatus: "found_current",
    status: "resolved",
  };
}

function getRecoveryFailure(application: RouteDraftApplication) {
  return (
    application.failure ?? {
      reason: "recovery_read_required" as const,
      source: "record" as const,
    }
  );
}

function getOwnedStateEditor(
  state: NoteBrowserStore,
  ownerKey: string,
): EditorSession | undefined {
  if (state.noteState.status !== "ready") {
    return undefined;
  }
  return state.noteState.editor.sessionKey === ownerKey
    ? state.noteState.editor
    : undefined;
}

function rebaseCommittedOwner(
  committed: NoteBrowserStore["committedRouteView"],
  sessionKey: string,
): NoteBrowserStore["committedRouteView"] {
  return committed?.view === "ready"
    ? { ...committed, renderedOwnerKey: sessionKey }
    : committed;
}

function getAbsentRecordStatus(
  application: RouteDraftApplication,
): "absent" | "invalid_deleted" {
  return application.failure?.source === "persistence"
    ? "invalid_deleted"
    : "absent";
}

function applyUnavailableIdentity(
  editor: EditorSession,
  context: StoreContext,
): RecoveryReadResult {
  const identity = context.get().clusterIdentity;
  const issue = createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch: editor.draftEpoch,
    failure: {
      reason: getUnavailableIdentityReason(identity),
      source: "cluster_identity",
    },
    noteId: editor.note.id,
    operation: "recovery_read",
    ownerKey: editor.sessionKey,
    retryAction: "retry_browser_recovery",
    sessionKey: editor.sessionKey,
  });
  context.set({
    noteState: {
      editor: { ...editor, persistenceIssue: issue },
      status: "ready",
    },
  });
  return {
    clusterId: undefined,
    disposition: "recovery_read_unavailable",
    issue,
    noteId: editor.note.id,
    ownerKey: editor.sessionKey,
    status: "failed",
  };
}

function getUnavailableIdentityReason(
  identity: NoteBrowserStore["clusterIdentity"],
) {
  return identity?.status === "unavailable"
    ? identity.reason
    : "metadata_unavailable";
}

function ownerLostResult(
  context: StoreContext,
  noteId = "",
  ownerKey = "",
): RecoveryReadResult {
  return {
    clusterId: getReadyClusterId(context.get().clusterIdentity),
    noteId,
    ownerKey,
    reason: "owner_lost",
    status: "superseded",
  };
}

function requireClusterId(clusterId: string | undefined): string {
  if (clusterId === undefined) {
    throw new Error("A resolved recovery result requires cluster identity.");
  }
  return clusterId;
}
