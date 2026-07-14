import {
  noteRouteSources,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import type {
  RouteNotesResult,
  RouteStoreApplyInput,
  RouteStoreApplyResult,
} from "../routing/route-store-executor.js";
import {
  getClusterIdentityPatch,
  getErrorMessage,
} from "./note-browser-action-utils.js";
import {
  createBrowserOperationEvidence,
  recordListResult,
  runBrowserOperation,
  staleFailed,
  staleSucceeded,
  type BrowserOperationEvidence,
} from "./note-browser-evidence.js";
import {
  readAuthorizedNote,
  recoverMissingAuthorizedRoute,
} from "./note-browser-read-actions.js";
import { getCoherentRouteView } from "./note-browser-route-predicates.js";
import {
  applyEmptyRoute,
  applyStorePatchAtomically,
} from "./note-browser-route-state.js";
import {
  nextNoteRequestSequence,
  nextNotesRequestSequence,
  type RouteWorkflowAccess,
  type RouteWorkflowRuntime,
} from "./note-browser-route-runtime.js";
import { createRequestMetadata } from "./note-operation-metadata.js";

type ListCompletion = {
  readonly access: RouteWorkflowAccess;
  readonly evidence: BrowserOperationEvidence;
  readonly requestSequence: number;
  readonly runtime: RouteWorkflowRuntime;
};

/** Coalesces and returns the one current notes-list readiness operation. */
export function ensureNotesAction(
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): Promise<RouteNotesResult> {
  const active = runtime.activeNotesLoad;
  if (active !== undefined) {
    return active.promise;
  }
  const ready = readReadyNotes(access);
  return ready === undefined
    ? startNotesLoad(access, runtime)
    : Promise.resolve(ready);
}

/** Applies one exact route intent across selection, recovery, and note reads. */
export function applyRouteAction(
  input: RouteStoreApplyInput,
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): Promise<RouteStoreApplyResult> {
  if (runtime.currentRouteIntentKey !== input.authorization.intentKey) {
    return Promise.resolve({ status: "stale" });
  }
  const coherent = getCoherentRouteView(
    {
      activeLoad: runtime.activeNoteLoad,
      noteId: input.noteId,
      occurrence: input.location,
    },
    access.state.getState(),
  );
  if (coherent !== undefined) {
    return Promise.resolve(coherent);
  }
  runtime.routeRollback.begin(access.state.getState());
  return applyIncoherentRoute(input, access, runtime);
}

function startNotesLoad(
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): Promise<RouteNotesResult> {
  const requestSequence = nextNotesRequestSequence(runtime);
  const metadata = createRequestMetadata();
  const evidence = createBrowserOperationEvidence({
    metadata,
    requestSequence,
  });
  access.state.setState({ notesState: { status: "loading" } });
  const promise = runBrowserOperation({
    callback: async () =>
      await performNotesLoad(metadata, {
        access,
        evidence,
        requestSequence,
        runtime,
      }),
    evidence,
    eventName: runtimeObservabilityEventNames.notesListStarted,
    spanName: runtimeSpanNames.notesList,
    startAttributes: {},
  }).finally(() => {
    if (runtime.activeNotesLoad?.promise === promise) {
      runtime.activeNotesLoad = undefined;
    }
  });
  runtime.activeNotesLoad = { promise, requestSequence };
  return promise;
}

async function performNotesLoad(
  metadata: Parameters<RouteWorkflowAccess["api"]["listNotes"]>[0],
  completion: ListCompletion,
): Promise<RouteNotesResult> {
  try {
    const response = await completion.access.api.listNotes(metadata);
    return applyListSuccess(response, completion);
  } catch (error) {
    return applyListFailure(error, completion);
  }
}

function applyListSuccess(
  response: Awaited<ReturnType<RouteWorkflowAccess["api"]["listNotes"]>>,
  completion: ListCompletion,
): RouteNotesResult {
  if (completion.requestSequence !== completion.runtime.notesRequestSequence) {
    recordListResult(completion.evidence, { staleCompletion: staleSucceeded });
    return { status: "failed" };
  }
  const applied = applyStorePatchAtomically(
    {
      ...getClusterIdentityPatch(
        response.clusterIdentity,
        completion.access.state.getState().draftRecoveryStatus,
      ),
      notesState: { data: response.notes, status: "ready" },
    },
    completion.access.state,
  );
  recordListApplicationResult(response, completion.evidence, applied);
  if (!applied) {
    return { status: "failed" };
  }
  return { noteIds: response.notes.map((note) => note.id), status: "ready" };
}

function recordListApplicationResult(
  response: Awaited<ReturnType<RouteWorkflowAccess["api"]["listNotes"]>>,
  evidence: BrowserOperationEvidence,
  applied: boolean,
): void {
  recordListResult(
    evidence,
    applied
      ? {
          clusterIdentity: response.clusterIdentity,
          noteCount: response.notes.length,
        }
      : { error: storeApplyError },
  );
}

function applyListFailure(
  error: unknown,
  completion: ListCompletion,
): RouteNotesResult {
  if (completion.requestSequence !== completion.runtime.notesRequestSequence) {
    recordListResult(completion.evidence, { staleCompletion: staleFailed });
    return { status: "failed" };
  }
  recordListResult(completion.evidence, { error });
  applyStorePatchAtomically(
    { notesState: { message: getErrorMessage(error), status: "error" } },
    completion.access.state,
  );
  return { status: "failed" };
}

function readReadyNotes(
  access: RouteWorkflowAccess,
): RouteNotesResult | undefined {
  const notesState = access.state.getState().notesState;
  return notesState.status === "ready"
    ? { noteIds: notesState.data.map((note) => note.id), status: "ready" }
    : undefined;
}

function applyIncoherentRoute(
  input: RouteStoreApplyInput,
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): Promise<RouteStoreApplyResult> {
  if (input.noteId === undefined) {
    const result: RouteStoreApplyResult = applyEmptyRoute(
      input.location,
      access.state,
      runtime.routeRollback.commit,
    )
      ? {
          requestSequence: undefined,
          status: "applied",
          view: "empty",
        }
      : { reason: "store_apply_failed", status: "failed" };
    restoreFailedApplication(result, access, runtime);
    return Promise.resolve(result);
  }
  return applyNoteRoute({ ...input, noteId: input.noteId }, access, runtime);
}

function applyNoteRoute(
  input: RouteStoreApplyInput & { readonly noteId: string },
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): Promise<RouteStoreApplyResult> {
  const readInput = {
    authorization: input.authorization,
    location: input.location,
    noteId: input.noteId,
    routeSource: input.cause,
  };
  return isNoteInReadyList(input.noteId, access)
    ? readAuthorizedNote(readInput, access, runtime)
    : recoverMissingAuthorizedRoute(readInput, access, runtime);
}

function isNoteInReadyList(
  noteId: string,
  access: RouteWorkflowAccess,
): boolean {
  const notesState = access.state.getState().notesState;
  return (
    notesState.status === "ready" &&
    notesState.data.some((note) => note.id === noteId)
  );
}

/** Forces a fresh same-note read without route or history ownership. */
export async function reloadSelectedNoteAction(
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): Promise<RouteStoreApplyResult> {
  const target = getExplicitReloadTarget(access);
  if (target === undefined) {
    return { status: "stale" };
  }
  runtime.routeRollback.begin(access.state.getState());
  return await readAuthorizedNote(
    {
      authorization: {
        authorizationKey: `explicit-reload-${String(nextNoteRequestSequence(runtime))}`,
        kind: "explicit_reload",
        source: "draft_discard_reload",
      },
      forceReload: true,
      location: target.location,
      noteId: target.noteId,
      routeSource: noteRouteSources.draftDiscardReload,
    },
    access,
    runtime,
  );
}

function restoreFailedApplication(
  result: RouteStoreApplyResult,
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): void {
  if (result.status === "failed" && result.reason === "store_apply_failed") {
    runtime.routeRollback.restore(
      access.state.getState(),
      access.state.setState,
    );
  }
}

function getExplicitReloadTarget(access: RouteWorkflowAccess):
  | {
      readonly location: NonNullable<
        ReturnType<
          RouteWorkflowAccess["state"]["getState"]
        >["committedRouteView"]
      >["location"];
      readonly noteId: string;
    }
  | undefined {
  const snapshot = access.state.getState();
  if (snapshot.selectedNoteId === undefined) {
    return undefined;
  }
  const location = getCommittedLocation(snapshot.committedRouteView);
  return location === undefined
    ? undefined
    : { location, noteId: snapshot.selectedNoteId };
}

function getCommittedLocation(
  view: ReturnType<
    RouteWorkflowAccess["state"]["getState"]
  >["committedRouteView"],
) {
  return view?.location;
}

const storeApplyError = new Error("The note list could not be applied.");
