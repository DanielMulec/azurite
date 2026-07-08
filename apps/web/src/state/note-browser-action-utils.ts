import {
  apiErrorCodes,
  type ClusterIdentity,
  type NoteContentWithHash,
  type NoteSummary,
} from "@azurite/shared";

import { WebApiError } from "../api-client.js";
import type { DraftPersistenceUnavailableReason } from "../persistence/draft-database.js";
import type { DraftRecord } from "../persistence/draft-records.js";
import type {
  DraftRecoveryStatus,
  DraftRecoveryKind,
  EditorSession,
  LoadableNotes,
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
  if (clusterIdentity.status !== "ready") {
    applyUnavailableClusterIdentity(clusterIdentity, context);
    return;
  }

  context.set({
    clusterIdentity,
    draftRecoveryStatus: getReadyClusterRecoveryStatus(context),
  });
}

/** Creates a resolved editor session after note and draft recovery load. */
export function createEditorSession(
  note: NoteContentWithHash,
  draft: DraftRecord | undefined,
  context: Pick<StoreContext, "nextEditorSessionKey">,
): EditorSession {
  const recovery = getDraftRecovery(note, draft);

  return {
    baseContentHash: getBaseContentHash(note, draft),
    currentMarkdown: getCurrentMarkdown(note, draft),
    editorMode: getEditorMode(draft),
    note,
    recovery,
    savedMarkdown: note.markdown,
    saveStatus: getInitialSaveStatus(recovery),
    sessionKey: context.nextEditorSessionKey(note.id, note.contentHash),
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
  return hasDirtyMarkdown(editor) && !isEditorSaveBlocked(editor);
}

/** Returns whether current markdown differs from the saved disk baseline. */
export function hasDirtyMarkdown(editor: EditorSession): boolean {
  return (
    normalizeMarkdown(editor.currentMarkdown) !==
    normalizeMarkdown(editor.savedMarkdown)
  );
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

/** Marks durable browser draft recovery as degraded for a visible reason. */
export function degradeDraftRecovery(
  reason: DraftPersistenceUnavailableReason,
  context: Pick<StoreContext, "set">,
): void {
  context.set({
    draftRecoveryStatus: {
      message: "Draft recovery is degraded. Manual save still works.",
      reason,
      status: "degraded",
    },
  });
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

function applyUnavailableClusterIdentity(
  clusterIdentity: ClusterIdentity,
  context: Pick<StoreContext, "set">,
): void {
  context.set({
    clusterIdentity,
    draftRecoveryStatus: {
      message: "Draft recovery is unavailable for this cluster.",
      reason: "cluster_identity_unavailable",
      status: "degraded",
    },
  });
}

function getReadyClusterRecoveryStatus(
  context: Pick<StoreContext, "get">,
): DraftRecoveryStatus {
  const currentStatus = context.get().draftRecoveryStatus;

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
  recovery: DraftRecoveryKind,
): EditorSession["saveStatus"] {
  return recovery === "conflict" ? "conflict" : "idle";
}

function isEditorSaveBlocked(editor: EditorSession): boolean {
  return (
    blockedSaveStatuses.includes(editor.saveStatus) ||
    editor.recovery === "conflict"
  );
}

function getDraftRecovery(
  note: NoteContentWithHash,
  draft: DraftRecord | undefined,
): DraftRecoveryKind {
  if (draft === undefined) {
    return "none";
  }

  return draft.baseContentHash === note.contentHash ? "draft" : "conflict";
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

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n");
}
