import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { RecoveryReadResult } from "../persistence/draft-workflow-types.js";
import {
  createEditorSession,
  getReadyClusterId,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import { readRouteDraft } from "./note-browser-route-drafts.js";

/** Retries an unread browser record without replacing dirty live authority. */
export async function retryBrowserRecoveryAction(
  context: StoreContext,
): Promise<RecoveryReadResult> {
  const noteState = context.get().noteState;
  if (
    noteState.status !== "ready" ||
    noteState.editor.draftDisposition !== "recovery_read_unavailable"
  ) {
    return ownerLostResult(context);
  }
  const editor = noteState.editor;
  if (hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown)) {
    return {
      clusterId: editor.persistenceIssue?.clusterId,
      noteId: editor.note.id,
      ownerKey: editor.sessionKey,
      reason: "dirty_live_authority",
      status: "superseded",
    };
  }
  const identity = context.get().clusterIdentity;
  if (identity === undefined) {
    return applyUnavailableIdentity(editor, context);
  }
  const application = await readRouteDraft(editor.note.id, identity, context);
  const current = context.get().noteState;
  if (
    current.status !== "ready" ||
    current.editor.sessionKey !== editor.sessionKey
  ) {
    return ownerLostResult(context, editor.note.id, editor.sessionKey);
  }
  if (
    hasMarkdownDifference(
      current.editor.currentMarkdown,
      current.editor.savedMarkdown,
    )
  ) {
    return {
      clusterId: application.clusterId,
      noteId: editor.note.id,
      ownerKey: editor.sessionKey,
      reason: "dirty_live_authority",
      status: "superseded",
    };
  }
  return applyRecoveryApplication(editor.sessionKey, application, context);
}

function applyRecoveryApplication(
  ownerKey: string,
  application: Awaited<ReturnType<typeof readRouteDraft>>,
  context: StoreContext,
): RecoveryReadResult {
  const state = context.get();
  if (state.noteState.status !== "ready") {
    return ownerLostResult(context);
  }
  const noteId = state.noteState.editor.note.id;
  if (application.disposition === "recovery_read_unavailable") {
    const issue = createDraftPersistenceIssue({
      clusterId: application.clusterId,
      draftEpoch: state.noteState.editor.draftEpoch,
      failure: application.failure ?? {
        reason: "recovery_read_required",
        source: "record",
      },
      noteId,
      operation: "recovery_read",
      ownerKey,
      retryAction: "retry_browser_recovery",
      sessionKey: ownerKey,
    });
    context.set((current) =>
      current.noteState.status === "ready" &&
      current.noteState.editor.sessionKey === ownerKey
        ? {
            ...application.statePatch,
            noteState: {
              editor: { ...current.noteState.editor, persistenceIssue: issue },
              status: "ready",
            },
          }
        : current,
    );
    return {
      clusterId: application.clusterId,
      disposition: "recovery_read_unavailable",
      issue,
      noteId,
      ownerKey,
      status: "failed",
    };
  }
  if (application.disposition === "preserved_unknown") {
    context.set((current) =>
      current.noteState.status === "ready" &&
      current.noteState.editor.sessionKey === ownerKey
        ? {
            noteState: {
              editor: {
                ...current.noteState.editor,
                draftDisposition: "preserved_unknown",
                persistenceIssue: undefined,
                preservedSchemaVersion: application.preservedSchemaVersion,
              },
              status: "ready",
            },
          }
        : current,
    );
    return {
      clusterId: requireClusterId(application.clusterId),
      disposition: "preserved_unknown",
      noteId,
      ownerKey,
      schemaVersion: application.preservedSchemaVersion ?? 2,
      status: "preserved",
    };
  }
  return applyResolvedRecovery(ownerKey, application, context);
}

function applyResolvedRecovery(
  ownerKey: string,
  application: Awaited<ReturnType<typeof readRouteDraft>>,
  context: StoreContext,
): RecoveryReadResult {
  const state = context.get();
  if (state.noteState.status !== "ready") {
    return ownerLostResult(context);
  }
  const editor = createEditorSession(
    state.noteState.editor.note,
    application,
    context,
  );
  const committed = state.committedRouteView;
  context.set({
    ...application.statePatch,
    committedRouteView:
      committed?.view === "ready"
        ? { ...committed, renderedOwnerKey: editor.sessionKey }
        : committed,
    noteState: { editor, status: "ready" },
  });
  const clusterId = requireClusterId(application.clusterId);
  if (application.draft === undefined) {
    return {
      clusterId,
      disposition: "none",
      issue: editor.persistenceIssue,
      noteId: editor.note.id,
      ownerKey,
      recordStatus:
        application.failure?.source === "persistence"
          ? "invalid_deleted"
          : "absent",
      status: "resolved",
    };
  }
  return {
    clusterId,
    disposition: editor.draftDisposition as "conflict" | "recovered",
    noteId: editor.note.id,
    ownerKey,
    recordStatus: "found_current",
    status: "resolved",
  };
}

function applyUnavailableIdentity(
  editor: Extract<
    ReturnType<StoreContext["get"]>["noteState"],
    { status: "ready" }
  >["editor"],
  context: StoreContext,
): RecoveryReadResult {
  const identity = context.get().clusterIdentity;
  const issue = createDraftPersistenceIssue({
    clusterId: undefined,
    draftEpoch: editor.draftEpoch,
    failure: {
      reason:
        identity?.status === "unavailable"
          ? identity.reason
          : "metadata_unavailable",
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
