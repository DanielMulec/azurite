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
type SelectedNoteTarget = {
  readonly noteId: string;
  readonly requestSequence: number;
};
type LoadedNoteInput = SelectedNoteTarget & {
  readonly clusterIdentity: ReadNoteResponse["clusterIdentity"];
  readonly context: StoreContext;
  readonly note: NoteContentWithHash;
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
  const target = readEvidenceTarget(evidence);
  if (target === undefined) {
    return;
  }
  await readSelectedNoteTarget({ context, evidence }, target);
}

async function readSelectedNoteTarget(
  request: SelectedNoteRequest,
  target: SelectedNoteTarget,
): Promise<void> {
  try {
    const response = await request.context.api.readNote(
      target.noteId,
      request.evidence.metadata,
    );
    const applied = await applySelectedNoteResponse(response, request);
    recordReadSuccess(response, applied, request.evidence);
  } catch (error) {
    const applied = await applySelectedNoteFailure(error, request);
    recordReadFailure(error, applied, request.evidence);
  }
}

/** Resolves a valid route note that is absent from the current list. */
export async function recoverMissingRouteNote(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  const requestSequence = startMissingNoteLoad(noteId, context);
  const evidence = createBrowserOperationEvidence({
    metadata: Object.freeze({}),
    noteId,
    requestSequence,
  });
  await applyMissingNoteDraft(
    { context, evidence },
    { noteId, requestSequence },
  );
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
  return await applyLoadedNote({
    clusterIdentity: response.clusterIdentity,
    context: request.context,
    note: response.note,
    ...target,
  });
}

async function applySelectedNoteFailure(
  error: unknown,
  request: SelectedNoteRequest,
): Promise<boolean> {
  const target = readEvidenceTarget(request.evidence);
  if (target === undefined) {
    return false;
  }
  return applyCurrentSelectedNoteFailure(error, request, target);
}

async function applyCurrentSelectedNoteFailure(
  error: unknown,
  request: SelectedNoteRequest,
  target: SelectedNoteTarget,
): Promise<boolean> {
  if (
    !request.context.isCurrentNoteRequest(target.requestSequence, target.noteId)
  ) {
    return false;
  }
  if (isNoteNotFoundError(error)) {
    return await applyMissingNoteDraft(request, target);
  }
  request.context.set({
    noteState: { message: getErrorMessage(error), status: "error" },
  });
  return true;
}

async function applyLoadedNote(input: LoadedNoteInput): Promise<boolean> {
  const draftLookup = await readDraftForCurrentCluster(
    input.note.id,
    input.context,
  );
  if (
    !input.context.isCurrentNoteRequest(input.requestSequence, input.note.id)
  ) {
    return false;
  }
  const draft = applyDraftLookupResult(draftLookup, input.context);
  applyClusterIdentity(input.clusterIdentity, input.context);
  input.context.set({
    noteState: {
      editor: createEditorSession(input.note, draft, input.context),
      status: "ready",
    },
  });
  return true;
}

async function applyMissingNoteDraft(
  request: SelectedNoteRequest,
  target: SelectedNoteTarget,
): Promise<boolean> {
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
): SelectedNoteTarget | undefined {
  if (evidence.noteId === undefined) {
    return undefined;
  }
  if (evidence.requestSequence === undefined) {
    return undefined;
  }
  return { noteId: evidence.noteId, requestSequence: evidence.requestSequence };
}

function recordReadSuccess(
  response: ReadNoteResponse,
  applied: boolean,
  evidence: BrowserOperationEvidence,
): void {
  if (!applied) {
    recordLoadResult(evidence, { staleCompletion: staleSucceeded });
    return;
  }
  recordLoadResult(evidence, {
    clusterIdentity: response.clusterIdentity,
    contentHash: response.note.contentHash,
    markdownLength: response.note.markdown.length,
  });
}

function recordReadFailure(
  error: unknown,
  applied: boolean,
  evidence: BrowserOperationEvidence,
): void {
  if (!applied) {
    recordLoadResult(evidence, { staleCompletion: staleFailed });
    return;
  }
  recordLoadResult(evidence, { error });
}
