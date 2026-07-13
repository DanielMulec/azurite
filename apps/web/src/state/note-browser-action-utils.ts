import {
  apiErrorCodes,
  type ClusterIdentity,
  type NoteContentWithHash,
  type NoteSummary,
} from "@azurite/shared";

import { WebApiError } from "../api-client.js";
import { hasMarkdownDifference } from "../domain/markdown-equality.js";
import type { DraftPersistenceUnavailableReason } from "../persistence/draft-database.js";
import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { DraftRecord } from "../persistence/draft-records.js";
import type { RouteDraftApplication } from "./note-browser-route-drafts.js";
import type {
  DraftRecoveryStatus,
  EditorSession,
  LoadableNotes,
  NoteBrowserSnapshot,
  NoteViewState,
} from "./note-browser-types.js";
import type { StoreContext } from "./note-browser-contracts.js";

const blockedSaveStatuses: readonly EditorSession["saveStatus"][] = [
  "conflict",
  "saving",
];

/** Applies cluster identity and updates visible draft recovery availability. */
export function applyClusterIdentity(
  clusterIdentity: ClusterIdentity,
  context: Pick<StoreContext, "get" | "set">,
): void {
  context.set(
    getClusterIdentityPatch(clusterIdentity, context.get().draftRecoveryStatus),
  );
}

/** Computes cluster and recovery state without mutating a route transaction. */
export function getClusterIdentityPatch(
  clusterIdentity: ClusterIdentity,
  currentStatus: DraftRecoveryStatus,
): Pick<NoteBrowserSnapshot, "clusterIdentity" | "draftRecoveryStatus"> {
  if (clusterIdentity.status !== "ready") {
    return {
      clusterIdentity,
      draftRecoveryStatus: {
        message: "Draft recovery is unavailable for this cluster.",
        reason: "cluster_identity_unavailable",
        status: "degraded",
      },
    };
  }
  return {
    clusterIdentity,
    draftRecoveryStatus: getReadyClusterRecoveryStatus(currentStatus),
  };
}

/** Creates a resolved editor session after note and draft recovery load. */
export function createEditorSession(
  note: NoteContentWithHash,
  draftApplication: RouteDraftApplication,
  context: Pick<StoreContext, "nextEditorSessionKey">,
): EditorSession {
  const draft = draftApplication.draft;
  const draftDisposition = getDraftDisposition(note, draftApplication);
  const sessionKey = context.nextEditorSessionKey(note.id, note.contentHash);
  const recoveredSnapshotKey =
    draft === undefined ? undefined : `${sessionKey}:recovered-record`;

  return {
    baseContentHash: getBaseContentHash(note, draft),
    currentMarkdown: getCurrentMarkdown(note, draft),
    draftDisposition,
    draftEpoch: 0,
    durableSnapshotKey: recoveredSnapshotKey,
    editorMode: getEditorMode(draft),
    lastSnapshotKey: recoveredSnapshotKey,
    note,
    persistenceIssue: createInitialPersistenceIssue(
      note.id,
      sessionKey,
      draftApplication,
    ),
    preservedSchemaVersion: draftApplication.preservedSchemaVersion,
    revision: 0,
    savedMarkdown: note.markdown,
    saveStatus: getInitialSaveStatus(draftDisposition),
    sessionKey,
  };
}

/** Updates a note summary after the selected note is saved. */
export function patchSavedNoteSummary(
  notesState: LoadableNotes,
  note: NoteContentWithHash,
): LoadableNotes {
  if (notesState.status !== "ready") {
    return notesState;
  }

  return {
    data: notesState.data.map((summary) =>
      summary.id === note.id ? toNoteSummary(note) : summary,
    ),
    status: "ready",
  };
}

/** Returns whether the current editor session may be saved manually. */
export function canSaveEditor(editor: EditorSession): boolean {
  if (isEditorSaveBlocked(editor)) {
    return false;
  }
  return hasDirtyMarkdown(editor) || editor.draftDisposition === "recovered";
}

/** Returns whether current markdown differs from the saved disk baseline. */
export function hasDirtyMarkdown(editor: EditorSession): boolean {
  return hasMarkdownDifference(editor.currentMarkdown, editor.savedMarkdown);
}

/** Returns the usable cluster ID when cluster identity is ready. */
export function getReadyClusterId(
  clusterIdentity: ClusterIdentity | undefined,
): string | undefined {
  return clusterIdentity?.status === "ready"
    ? clusterIdentity.clusterId
    : undefined;
}

/** Keeps the rendered note visible while a replacement note is loading. */
export function keepRenderedNoteWhileLoading(
  noteState: NoteViewState,
): NoteViewState {
  return noteState.status === "ready" ? noteState : { status: "loading" };
}

/** Returns whether the requested note is already loaded and ready. */
export function isSelectedNoteReady(
  noteId: string,
  noteState: NoteViewState,
): boolean {
  return noteState.status === "ready" && noteState.editor.note.id === noteId;
}

/** Returns the current ready editor for the requested note, if still active. */
export function getCurrentEditorForNote(
  noteId: string,
  context: Pick<StoreContext, "get">,
): EditorSession | undefined {
  const noteState = context.get().noteState;

  if (noteState.status !== "ready") {
    return undefined;
  }

  return noteState.editor.note.id === noteId ? noteState.editor : undefined;
}

/** Returns the current editor only when the exact originating session owns it. */
export function getCurrentEditorForSession(
  editor: Pick<EditorSession, "note" | "sessionKey">,
  context: Pick<StoreContext, "get">,
): EditorSession | undefined {
  const currentEditor = getCurrentEditorForNote(editor.note.id, context);

  return currentEditor?.sessionKey === editor.sessionKey
    ? currentEditor
    : undefined;
}

/** Returns whether a save response still targets the exact editor snapshot. */
export function isSameSaveSnapshot(
  currentEditor: EditorSession,
  editor: EditorSession,
): boolean {
  return (
    currentEditor.sessionKey === editor.sessionKey &&
    currentEditor.revision === editor.revision
  );
}

/** Returns whether an editor patch changes user-visible editor state. */
export function hasEditorPatchChange(
  editor: EditorSession,
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
): boolean {
  return (
    hasMarkdownPatchChange(editor, patch) || hasModePatchChange(editor, patch)
  );
}

function hasMarkdownPatchChange(
  editor: EditorSession,
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
): boolean {
  return (
    patch.currentMarkdown !== undefined &&
    patch.currentMarkdown !== editor.currentMarkdown
  );
}

function hasModePatchChange(
  editor: EditorSession,
  patch: Partial<Pick<EditorSession, "currentMarkdown" | "editorMode">>,
): boolean {
  return (
    patch.editorMode !== undefined && patch.editorMode !== editor.editorMode
  );
}

/** Marks durable browser draft recovery as degraded for a visible reason. */
export function degradeDraftRecovery(
  reason: DraftPersistenceUnavailableReason,
  context: Pick<StoreContext, "set">,
): void {
  context.set({ draftRecoveryStatus: getDegradedDraftRecoveryStatus(reason) });
}

/** Creates the visible degraded state for one browser-draft failure. */
export function getDegradedDraftRecoveryStatus(
  reason: DraftPersistenceUnavailableReason,
): DraftRecoveryStatus {
  return {
    message: "Draft recovery is degraded. Manual save still works.",
    reason,
    status: "degraded",
  };
}

/** Converts unknown failures into safe user-facing messages. */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Azurite could not complete the note request.";
}

/** Returns whether an API error represents a missing note. */
export function isNoteNotFoundError(error: unknown): boolean {
  return (
    error instanceof WebApiError && error.code === apiErrorCodes.noteNotFound
  );
}

/** Returns whether an API error represents Slice 5 content-hash conflict. */
export function isNoteWriteConflictError(error: unknown): boolean {
  return (
    error instanceof WebApiError &&
    error.code === apiErrorCodes.noteWriteConflict
  );
}

function getReadyClusterRecoveryStatus(
  currentStatus: DraftRecoveryStatus,
): DraftRecoveryStatus {
  if (shouldPreserveDraftRecoveryStatus(currentStatus)) {
    return currentStatus;
  }

  return { status: "available" };
}

function shouldPreserveDraftRecoveryStatus(
  status: DraftRecoveryStatus,
): boolean {
  return (
    status.status === "degraded" &&
    status.reason !== "cluster_identity_unavailable"
  );
}

function getBaseContentHash(
  note: NoteContentWithHash,
  draft: DraftRecord | undefined,
): string {
  return draft === undefined ? note.contentHash : draft.baseContentHash;
}

function getCurrentMarkdown(
  note: NoteContentWithHash,
  draft: DraftRecord | undefined,
): string {
  return draft === undefined ? note.markdown : draft.markdown;
}

function getEditorMode(
  draft: DraftRecord | undefined,
): EditorSession["editorMode"] {
  return draft === undefined ? "wysiwyg" : draft.editorMode;
}

function getInitialSaveStatus(
  disposition: EditorSession["draftDisposition"],
): EditorSession["saveStatus"] {
  return disposition === "conflict" ? "conflict" : "idle";
}

function isEditorSaveBlocked(editor: EditorSession): boolean {
  return (
    blockedSaveStatuses.includes(editor.saveStatus) ||
    editor.draftDisposition === "conflict"
  );
}

function getDraftDisposition(
  note: NoteContentWithHash,
  application: RouteDraftApplication,
): EditorSession["draftDisposition"] {
  if (application.draft === undefined) {
    return application.disposition;
  }

  return application.draft.baseContentHash === note.contentHash
    ? "recovered"
    : "conflict";
}

function createInitialPersistenceIssue(
  noteId: string,
  sessionKey: string,
  application: RouteDraftApplication,
) {
  if (
    application.failure === undefined ||
    application.disposition === "preserved_unknown"
  ) {
    return undefined;
  }
  return createDraftPersistenceIssue({
    clusterId: application.clusterId,
    draftEpoch: 0,
    failure: application.failure,
    noteId,
    operation: "recovery_read",
    ownerKey: sessionKey,
    retryAction:
      application.disposition === "recovery_read_unavailable"
        ? "retry_browser_recovery"
        : undefined,
    sessionKey,
  });
}

function toNoteSummary(note: NoteContentWithHash): NoteSummary {
  return {
    fileName: note.fileName,
    id: note.id,
    lastModifiedAt: note.lastModifiedAt,
    relativePath: note.relativePath,
    sizeBytes: note.sizeBytes,
    title: note.title,
  };
}
