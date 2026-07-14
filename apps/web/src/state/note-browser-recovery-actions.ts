import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import { createEditorSession } from "./note-browser-action-utils.js";
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
): Promise<void> {
  const editor = getRecoveryRetryEditor(context);
  if (!isCleanRecoveryEditor(editor)) {
    return;
  }
  const identity = context.get().clusterIdentity;
  if (identity === undefined) {
    applyUnavailableIdentity(editor, context);
    return;
  }
  const application = await readRouteDraft(editor.note.id, identity, context);
  const current = getExactRecoveryEditor(editor.sessionKey, context);
  if (!isCleanRecoveryEditor(current)) {
    return;
  }
  applyRecoveryApplication(editor.sessionKey, application, context);
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

function applyRecoveryApplication(
  ownerKey: string,
  application: RouteDraftApplication,
  context: StoreContext,
): void {
  const editor = getExactRecoveryEditor(ownerKey, context);
  if (editor === undefined) {
    return;
  }
  if (application.disposition === "recovery_read_unavailable") {
    applyUnavailableRecovery(editor, application, context);
    return;
  }
  if (application.disposition === "preserved_unknown") {
    applyProtectedRecovery(editor, application, context);
    return;
  }
  applyResolvedRecovery(editor, application, context);
}

function applyUnavailableRecovery(
  editor: EditorSession,
  application: RouteDraftApplication,
  context: StoreContext,
): void {
  const issue = createDraftPersistenceIssue({
    clusterId: application.clusterId,
    draftEpoch: editor.draftEpoch,
    failure: application.failure ?? {
      reason: "recovery_read_required",
      source: "record",
    },
    noteId: editor.note.id,
    operation: "recovery_read",
    ownerKey: editor.sessionKey,
    retryAction: "retry_browser_recovery",
    sessionKey: editor.sessionKey,
  });
  context.set((state) => {
    const owned = getOwnedStateEditor(state, editor.sessionKey);
    return owned === undefined
      ? state
      : {
          ...application.statePatch,
          noteState: {
            editor: { ...owned, persistenceIssue: issue },
            status: "ready",
          },
        };
  });
}

function applyProtectedRecovery(
  editor: EditorSession,
  application: RouteDraftApplication,
  context: StoreContext,
): void {
  context.set((state) => {
    const owned = getOwnedStateEditor(state, editor.sessionKey);
    return owned === undefined
      ? state
      : {
          draftRecoveryStatus: { status: "available" },
          noteState: {
            editor: {
              ...owned,
              draftDisposition: "preserved_unknown",
              persistenceIssue: undefined,
              preservedSchemaVersion: application.preservedSchemaVersion,
            },
            status: "ready",
          },
        };
  });
}

function applyResolvedRecovery(
  editor: EditorSession,
  application: RouteDraftApplication,
  context: StoreContext,
): void {
  const replacement = createEditorSession(editor.note, application, context);
  context.set({
    ...getResolvedRecoveryStatePatch(application),
    committedRouteView: rebaseCommittedOwner(
      context.get().committedRouteView,
      replacement.sessionKey,
    ),
    noteState: { editor: replacement, status: "ready" },
  });
}

function getResolvedRecoveryStatePatch(
  application: RouteDraftApplication,
): RouteDraftApplication["statePatch"] {
  return application.failure?.reason === "validation_failed"
    ? application.statePatch
    : { draftRecoveryStatus: { status: "available" } };
}

function applyUnavailableIdentity(
  editor: EditorSession,
  context: StoreContext,
): void {
  const issue = createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch: editor.draftEpoch,
    failure: { reason: "metadata_unavailable", source: "cluster_identity" },
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

function isDirty(editor: EditorSession): boolean {
  return hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown);
}

function isCleanRecoveryEditor(
  editor: EditorSession | undefined,
): editor is EditorSession {
  return editor !== undefined && !isDirty(editor);
}
