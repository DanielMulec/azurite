import type { ReadNoteResponse } from "@azurite/shared";
import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import type {
  DraftPersistenceUnavailableReason,
  DraftReadResult,
} from "../persistence/draft-database.js";
import type { DraftRecord } from "../persistence/draft-records.js";
import type { RouteStoreApplyResult } from "../routing/route-store-executor.js";
import type {
  NoteLoadAuthorization,
  ValidatedLocationOccurrence,
} from "../routing/route-transition-types.js";
import {
  applyClusterIdentity,
  createEditorSession,
  degradeDraftRecovery,
  getErrorMessage,
  getReadyClusterId,
  isNoteNotFoundError,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  createBrowserOperationEvidence,
  recordLoadResult,
  recordRouteEvidence,
  runBrowserOperation,
  staleFailed,
  staleSucceeded,
  type BrowserOperationEvidence,
} from "./note-browser-evidence.js";
import {
  applyErrorRoute,
  applyMissingDraftRoute,
  applyMissingRoute,
  applyPendingRouteSelection,
  applyReadyRoute,
} from "./note-browser-route-state.js";
import { createNoteRequestMetadata } from "./note-operation-metadata.js";

/** Exact route-or-reload authorization and destination for one note read. */
export type AuthorizedNoteReadInput = {
  readonly authorization: NoteLoadAuthorization;
  readonly forceReload?: boolean;
  readonly location: ValidatedLocationOccurrence;
  readonly noteId: string;
  readonly routeSource: string;
};

type NoteRequest = {
  readonly context: StoreContext;
  readonly evidence: BrowserOperationEvidence;
  readonly input: AuthorizedNoteReadInput;
  readonly requestSequence: number;
};

type DraftLookupResult =
  | { readonly draft: DraftRecord | undefined; readonly status: "ready" }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Reads one note under exact route-or-reload authorization. */
export function readAuthorizedNote(
  input: AuthorizedNoteReadInput,
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  const coalesced = getCoalescedPromise(input, context);
  if (coalesced !== undefined) {
    return coalesced;
  }
  return startAuthorizedRead(input, context);
}

/** Resolves an explicit route missing from the current ready note list. */
export async function recoverMissingAuthorizedRoute(
  input: AuthorizedNoteReadInput,
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  const requestSequence = context.nextNoteRequestSequence();
  if (!applyPendingRouteSelection(input.noteId, context)) {
    return storeApplyFailed;
  }
  const request = createRequest(input, requestSequence, context);
  const result = await applyMissingDraft(request);
  recordRouteEvidence(
    runtimeObservabilityEventNames.noteRouteSynchronized,
    input.noteId,
    input.routeSource,
  );
  return result;
}

function startAuthorizedRead(
  input: AuthorizedNoteReadInput,
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  const requestSequence = context.nextNoteRequestSequence();
  if (!applyPendingRouteSelection(input.noteId, context)) {
    return Promise.resolve(storeApplyFailed);
  }
  const request = createRequest(input, requestSequence, context);
  recordSelectionRoute(input.noteId, input.routeSource);
  const promise = runBrowserOperation({
    callback: async () => await performAuthorizedRead(request),
    evidence: request.evidence,
    eventName: runtimeObservabilityEventNames.noteLoadStarted,
    spanName: runtimeSpanNames.noteLoad,
    startAttributes: {
      [runtimeObservabilityAttributeNames.routeSource]: input.routeSource,
    },
  }).finally(() => {
    context.clearActiveNoteLoad(promise);
  });
  context.setActiveNoteLoad({
    authorization: input.authorization,
    metadata: request.evidence.metadata,
    noteId: input.noteId,
    promise,
    requestSequence,
    routeSource: input.routeSource,
  });
  return promise;
}

function createRequest(
  input: AuthorizedNoteReadInput,
  requestSequence: number,
  context: StoreContext,
): NoteRequest {
  return {
    context,
    evidence: createBrowserOperationEvidence({
      metadata: createNoteRequestMetadata(),
      noteId: input.noteId,
      requestSequence,
      routeSource: input.routeSource,
    }),
    input,
    requestSequence,
  };
}

async function performAuthorizedRead(
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  try {
    const response = await request.context.api.readNote(
      request.input.noteId,
      request.evidence.metadata,
    );
    return await applyReadResponse(response, request);
  } catch (error) {
    return await applyReadFailure(error, request);
  }
}

async function applyReadResponse(
  response: ReadNoteResponse,
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  if (!isCurrentRequest(request)) {
    recordLoadResult(request.evidence, { staleCompletion: staleSucceeded });
    return { status: "stale" };
  }
  const result = await applyLoadedNote(response, request);
  recordReadSuccess(response, result, request.evidence);
  return result;
}

async function applyLoadedNote(
  response: ReadNoteResponse,
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  const note = response.note;
  const draftLookup = await readDraftForCurrentCluster(
    note.id,
    request.context,
  );
  if (!isCurrentRequest(request)) {
    return { status: "stale" };
  }
  const draft = applyDraftLookupResult(draftLookup, request.context);
  applyClusterIdentity(response.clusterIdentity, request.context);
  const editor = createEditorSession(note, draft, request.context);
  return applyReadyRoute(
    { editor, location: request.input.location, noteId: note.id },
    request.context,
  )
    ? { requestSequence: request.requestSequence, status: "applied", view: "ready" }
    : storeApplyFailed;
}

async function applyReadFailure(
  error: unknown,
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  if (!isCurrentRequest(request)) {
    recordLoadResult(request.evidence, { staleCompletion: staleFailed });
    return { status: "stale" };
  }
  const result = isNoteNotFoundError(error)
    ? await applyMissingDraft(request)
    : applyTargetError(error, request);
  recordReadFailure(error, result, request.evidence);
  return result;
}

async function applyMissingDraft(
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  const lookup = await readDraftForCurrentCluster(
    request.input.noteId,
    request.context,
  );
  if (!isCurrentRequest(request)) {
    return { status: "stale" };
  }
  const draft = applyDraftLookupResult(lookup, request.context);
  return draft === undefined
    ? applyMissingWithoutDraft(request)
    : applyRecoveredMissingDraft(draft, request);
}

function applyMissingWithoutDraft(request: NoteRequest): RouteStoreApplyResult {
  const applied = applyMissingRoute(
    { location: request.input.location, noteId: request.input.noteId },
    request.context,
  );
  return applied
    ? { requestSequence: request.requestSequence, status: "applied", view: "missing" }
    : storeApplyFailed;
}

function applyRecoveredMissingDraft(
  draft: DraftRecord,
  request: NoteRequest,
): RouteStoreApplyResult {
  const renderedOwnerKey = request.context.nextEditorSessionKey(
    request.input.noteId,
    "missing-draft",
  );
  const applied = applyMissingDraftRoute(
    {
      draft: {
        editorMode: draft.editorMode,
        markdown: draft.markdown,
        updatedAt: draft.updatedAt,
      },
      location: request.input.location,
      noteId: request.input.noteId,
      renderedOwnerKey,
    },
    request.context,
  );
  return applied
    ? {
        requestSequence: request.requestSequence,
        status: "applied",
        view: "missing_draft",
      }
    : storeApplyFailed;
}

function applyTargetError(
  error: unknown,
  request: NoteRequest,
): RouteStoreApplyResult {
  const applied = applyErrorRoute(
    {
      location: request.input.location,
      message: getErrorMessage(error),
      noteId: request.input.noteId,
    },
    request.context,
  );
  return applied
    ? { reason: "note_read_failed", status: "failed" }
    : storeApplyFailed;
}

function isCurrentRequest(request: NoteRequest): boolean {
  return request.context.isCurrentNoteRequest(
    request.input.authorization,
    request.requestSequence,
    request.input.noteId,
  );
}

function getCoalescedPromise(
  input: AuthorizedNoteReadInput,
  context: StoreContext,
): Promise<RouteStoreApplyResult> | undefined {
  if (input.forceReload === true) {
    return undefined;
  }
  const active = context.getActiveNoteLoad();
  return hasSameAuthorization(active, input) ? active.promise : undefined;
}

function hasSameAuthorization(
  active: ReturnType<StoreContext["getActiveNoteLoad"]>,
  input: AuthorizedNoteReadInput,
): active is NonNullable<typeof active> {
  return (
    active?.noteId === input.noteId &&
    active.authorization.authorizationKey === input.authorization.authorizationKey
  );
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

function recordSelectionRoute(noteId: string, routeSource: string): void {
  recordRouteEvidence(
    runtimeObservabilityEventNames.noteRouteNavigationRequested,
    noteId,
    routeSource,
  );
}

function recordReadSuccess(
  response: ReadNoteResponse,
  result: RouteStoreApplyResult,
  evidence: BrowserOperationEvidence,
): void {
  if (result.status !== "applied") {
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
  result: RouteStoreApplyResult,
  evidence: BrowserOperationEvidence,
): void {
  if (result.status === "stale") {
    recordLoadResult(evidence, { staleCompletion: staleFailed });
    return;
  }
  recordLoadResult(evidence, { error });
}

const storeApplyFailed: RouteStoreApplyResult = Object.freeze({
  reason: "store_apply_failed",
  status: "failed",
});
