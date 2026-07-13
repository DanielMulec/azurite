import type { ReadNoteResponse } from "@azurite/shared";
import {
  noteRouteSources,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import type { RouteStoreApplyResult } from "../routing/route-store-executor.js";
import type {
  NoteLoadAuthorization,
  ValidatedLocationOccurrence,
} from "../routing/route-transition-types.js";
import {
  createEditorSession,
  getClusterIdentityPatch,
  getErrorMessage,
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
import { applyMissingRouteRead } from "./note-browser-missing-route-read.js";
import { readRouteDraft } from "./note-browser-route-drafts.js";
import {
  applyErrorRoute,
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

type NoteReadAttempt =
  | { readonly error: unknown; readonly status: "failed" }
  | { readonly response: ReadNoteResponse; readonly status: "succeeded" };

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
    context.restoreRoutePredecessor();
    return storeApplyFailed;
  }
  const request = createRequest(input, requestSequence, context);
  const result = await applyMissingDraftSafely(request);
  restoreFailedCurrentApplication(result, request);
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
    context.restoreRoutePredecessor();
    return Promise.resolve(storeApplyFailed);
  }
  const request = createRequest(input, requestSequence, context);
  recordSelectionRoute(input.noteId, input.routeSource);
  const promise = runBrowserOperation({
    callback: async () => {
      const result = await performAuthorizedRead(request);
      restoreFailedCurrentApplication(result, request);
      return result;
    },
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
  const attempt = await readNoteAttempt(request);
  return attempt.status === "failed"
    ? await applyReadFailureSafely(attempt.error, request)
    : await applyReadResponseSafely(attempt.response, request);
}

async function readNoteAttempt(request: NoteRequest): Promise<NoteReadAttempt> {
  try {
    const response = await request.context.api.readNote(
      request.input.noteId,
      request.evidence.metadata,
    );
    return { response, status: "succeeded" };
  } catch (error) {
    return { error, status: "failed" };
  }
}

async function applyReadResponseSafely(
  response: ReadNoteResponse,
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  try {
    return await applyReadResponse(response, request);
  } catch (error) {
    recordReadFailure(error, storeApplyFailed, request.evidence);
    return storeApplyFailed;
  }
}

async function applyReadFailureSafely(
  error: unknown,
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  try {
    return await applyReadFailure(error, request);
  } catch (applicationError) {
    recordReadFailure(applicationError, storeApplyFailed, request.evidence);
    return storeApplyFailed;
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
  const draftApplication = await readRouteDraft(
    note.id,
    response.clusterIdentity,
    request.context,
  );
  if (!isCurrentRequest(request)) {
    return { status: "stale" };
  }
  const editor = createEditorSession(note, draftApplication, request.context);
  const clusterPatch = getClusterIdentityPatch(
    response.clusterIdentity,
    request.context.get().draftRecoveryStatus,
  );
  return applyReadyRoute(
    {
      editor,
      location: request.input.location,
      noteId: note.id,
      statePatch: { ...clusterPatch, ...draftApplication.statePatch },
    },
    request.context,
  )
    ? {
        requestSequence: request.requestSequence,
        status: "applied",
        view: "ready",
      }
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
  return await applyMissingRouteRead({
    context: request.context,
    isCurrent: () => isCurrentRequest(request),
    location: request.input.location,
    noteId: request.input.noteId,
    requestSequence: request.requestSequence,
  });
}

async function applyMissingDraftSafely(
  request: NoteRequest,
): Promise<RouteStoreApplyResult> {
  try {
    return await applyMissingDraft(request);
  } catch (error) {
    recordReadFailure(error, storeApplyFailed, request.evidence);
    return storeApplyFailed;
  }
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

function restoreFailedCurrentApplication(
  result: RouteStoreApplyResult,
  request: NoteRequest,
): void {
  if (isStoreApplyFailure(result) && isCurrentRequest(request)) {
    request.context.restoreRoutePredecessor();
  }
}

function isStoreApplyFailure(result: RouteStoreApplyResult): boolean {
  return result.status === "failed" && result.reason === "store_apply_failed";
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
    active.authorization.authorizationKey ===
      input.authorization.authorizationKey
  );
}

function recordSelectionRoute(noteId: string, routeSource: string): void {
  recordRouteEvidence(
    routeSource === noteRouteSources.urlSync
      ? runtimeObservabilityEventNames.noteRouteSynchronized
      : runtimeObservabilityEventNames.noteRouteNavigationRequested,
    noteId,
    routeSource,
  );
}

function recordReadSuccess(
  response: ReadNoteResponse,
  result: RouteStoreApplyResult,
  evidence: BrowserOperationEvidence,
): void {
  if (result.status === "stale") {
    recordLoadResult(evidence, { staleCompletion: staleSucceeded });
    return;
  }
  if (result.status !== "applied") {
    recordLoadResult(evidence, { error: storeApplyError });
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
const storeApplyError = new Error("The note route could not be applied.");
