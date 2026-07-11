import type { NoteContentWithHash, ReadNoteResponse } from "@azurite/shared";

import type {
  DraftPersistenceUnavailableReason,
  DraftReadResult,
} from "../persistence/draft-database.js";
import type { DraftRecord } from "../persistence/draft-records.js";
import {
  applyClusterIdentity,
  createEditorSession,
  degradeDraftRecovery,
  getErrorMessage,
  getReadyClusterId,
  isNoteNotFoundError,
  keepRenderedNoteWhileLoading,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  createBrowserOperationEvidence,
  recordLoadResult,
  staleFailed,
  staleSucceeded,
  type BrowserOperationEvidence,
} from "./note-browser-evidence.js";

type SelectedNoteRequest = {
  readonly context: StoreContext;
  readonly evidence: BrowserOperationEvidence;
};
type DraftLookupResult =
  | { readonly draft: DraftRecord | undefined; readonly status: "ready" }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Reads and applies one selected note while retaining closure evidence. */
export async function readSelectedNote(
  evidence: BrowserOperationEvidence,
  context: StoreContext,
): Promise<void> {
  const noteId = evidence.noteId;
  const requestSequence = evidence.requestSequence;
  if (noteId === undefined || requestSequence === undefined) {
    return;
  }
  try {
    const response = await context.api.readNote(noteId, evidence.metadata);
    const applied = await applySelectedNoteResponse(response, {
      context,
      evidence,
    });
    recordLoadResult(
      evidence,
      applied
        ? {
            clusterIdentity: response.clusterIdentity,
            contentHash: response.note.contentHash,
            markdownLength: response.note.markdown.length,
          }
        : { staleCompletion: staleSucceeded },
    );
  } catch (error) {
    const applied = await applySelectedNoteFailure(error, {
      context,
      evidence,
    });
    recordLoadResult(
      evidence,
      applied ? { error } : { staleCompletion: staleFailed },
    );
  }
}

/** Resolves a valid route note that is absent from the current list. */
export async function recoverMissingRouteNote(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  const requestSequence = startMissingNoteLoad(noteId, context);
  await applyMissingNoteDraft({
    context,
    evidence: createBrowserOperationEvidence({
      metadata: Object.freeze({}),
      noteId,
      requestSequence,
    }),
  });
}

async function applySelectedNoteResponse(
  response: ReadNoteResponse,
  request: SelectedNoteRequest,
): Promise<boolean> {
  const target = readEvidenceTarget(request.evidence);
  if (
    target === undefined ||
    !request.context.isCurrentNoteRequest(target.requestSequence, target.noteId)
  ) {
    return false;
  }
  return await applyLoadedNote(
    response.clusterIdentity,
    response.note,
    target.requestSequence,
    request.context,
  );
}

async function applySelectedNoteFailure(
  error: unknown,
  request: SelectedNoteRequest,
): Promise<boolean> {
  const target = readEvidenceTarget(request.evidence);
  if (
    target === undefined ||
    !request.context.isCurrentNoteRequest(target.requestSequence, target.noteId)
  ) {
    return false;
  }
  if (isNoteNotFoundError(error)) {
    return await applyMissingNoteDraft(request);
  }
  request.context.set({
    noteState: { message: getErrorMessage(error), status: "error" },
  });
  return true;
}

async function applyLoadedNote(
  clusterIdentity: ReadNoteResponse["clusterIdentity"],
  note: NoteContentWithHash,
  requestSequence: number,
  context: StoreContext,
): Promise<boolean> {
  const draftLookup = await readDraftForCurrentCluster(note.id, context);
  if (!context.isCurrentNoteRequest(requestSequence, note.id)) {
    return false;
  }
  const draft = applyDraftLookupResult(draftLookup, context);
  applyClusterIdentity(clusterIdentity, context);
  context.set({
    noteState: {
      editor: createEditorSession(note, draft, context),
      status: "ready",
    },
  });
  return true;
}

async function applyMissingNoteDraft(
  request: SelectedNoteRequest,
): Promise<boolean> {
  const target = readEvidenceTarget(request.evidence);
  if (target === undefined) {
    return false;
  }
  const draftLookup = await readDraftForCurrentCluster(
    target.noteId,
    request.context,
  );
  if (
    !request.context.isCurrentNoteRequest(target.requestSequence, target.noteId)
  ) {
    return false;
  }
  const draft = applyDraftLookupResult(draftLookup, request.context);
  if (draft === undefined) {
    request.context.set({
      noteState: { noteId: target.noteId, status: "missing" },
      selectedNoteId: target.noteId,
    });
    return true;
  }
  request.context.set({
    noteState: {
      draft: {
        editorMode: draft.editorMode,
        markdown: draft.markdown,
        updatedAt: draft.updatedAt,
      },
      noteId: target.noteId,
      status: "missing-draft",
    },
    selectedNoteId: target.noteId,
  });
  return true;
}

function startMissingNoteLoad(noteId: string, context: StoreContext): number {
  const requestSequence = context.nextNoteRequestSequence();
  context.set((state) => ({
    noteState: keepRenderedNoteWhileLoading(state.noteState),
    selectedNoteId: noteId,
  }));
  return requestSequence;
}

async function readDraftForCurrentCluster(
  noteId: string,
  context: StoreContext,
): Promise<DraftLookupResult> {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    return { draft: undefined, status: "ready" };
  }
  return toDraftLookupResult(
    await context.draftPersistence.readDraft(clusterId, noteId),
  );
}

function toDraftLookupResult(result: DraftReadResult): DraftLookupResult {
  return result.status === "unavailable"
    ? { reason: result.reason, status: "unavailable" }
    : { draft: result.draft, status: "ready" };
}

function applyDraftLookupResult(
  result: DraftLookupResult,
  context: StoreContext,
): DraftRecord | undefined {
  if (result.status === "unavailable") {
    degradeDraftRecovery(result.reason, context);
    return undefined;
  }
  return result.draft;
}

function readEvidenceTarget(
  evidence: BrowserOperationEvidence,
): { readonly noteId: string; readonly requestSequence: number } | undefined {
  return evidence.noteId === undefined || evidence.requestSequence === undefined
    ? undefined
    : { noteId: evidence.noteId, requestSequence: evidence.requestSequence };
}
