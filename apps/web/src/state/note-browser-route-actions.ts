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
  applyClusterIdentity,
  getErrorMessage,
} from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
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
import { applyEmptyRoute } from "./note-browser-route-state.js";
import { createRequestMetadata } from "./note-operation-metadata.js";

type ListCompletion = {
  readonly context: StoreContext;
  readonly evidence: BrowserOperationEvidence;
  readonly requestSequence: number;
};

/** Coalesces and returns the one current notes-list readiness operation. */
export function ensureNotesAction(
  context: StoreContext,
): Promise<RouteNotesResult> {
  const active = context.getActiveNotesLoad();
  if (active !== undefined) {
    return active.promise;
  }
  const ready = readReadyNotes(context);
  return ready === undefined ? startNotesLoad(context) : Promise.resolve(ready);
}

/** Applies one exact route intent across selection, recovery, and note reads. */
export async function applyRouteAction(
  input: RouteStoreApplyInput,
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  if (context.getCurrentRouteIntentKey() !== input.authorization.intentKey) {
    return { status: "stale" };
  }
  const coherent = getCoherentRouteView(
    {
      activeLoad: context.getActiveNoteLoad(),
      noteId: input.noteId,
      occurrence: input.location,
    },
    context.get(),
  );
  if (coherent !== undefined) {
    return coherent;
  }
  return await applyIncoherentRoute(input, context);
}

function startNotesLoad(context: StoreContext): Promise<RouteNotesResult> {
  const requestSequence = context.nextNotesRequestSequence();
  const metadata = createRequestMetadata();
  const evidence = createBrowserOperationEvidence({
    metadata,
    requestSequence,
  });
  context.set({ notesState: { status: "loading" } });
  const promise = runBrowserOperation({
    callback: async () =>
      await performNotesLoad(metadata, {
        context,
        evidence,
        requestSequence,
      }),
    evidence,
    eventName: runtimeObservabilityEventNames.notesListStarted,
    spanName: runtimeSpanNames.notesList,
    startAttributes: {},
  }).finally(() => {
    context.clearActiveNotesLoad(promise);
  });
  context.setActiveNotesLoad({ promise, requestSequence });
  return promise;
}

async function performNotesLoad(
  metadata: Parameters<StoreContext["api"]["listNotes"]>[0],
  completion: ListCompletion,
): Promise<RouteNotesResult> {
  try {
    const response = await completion.context.api.listNotes(metadata);
    return applyListSuccess(response, completion);
  } catch (error) {
    return applyListFailure(error, completion);
  }
}

function applyListSuccess(
  response: Awaited<ReturnType<StoreContext["api"]["listNotes"]>>,
  completion: ListCompletion,
): RouteNotesResult {
  if (!completion.context.isCurrentNotesRequest(completion.requestSequence)) {
    recordListResult(completion.evidence, { staleCompletion: staleSucceeded });
    return { status: "failed" };
  }
  recordListResult(completion.evidence, {
    clusterIdentity: response.clusterIdentity,
    noteCount: response.notes.length,
  });
  applyClusterIdentity(response.clusterIdentity, completion.context);
  completion.context.set({
    notesState: { data: response.notes, status: "ready" },
  });
  return { noteIds: response.notes.map((note) => note.id), status: "ready" };
}

function applyListFailure(
  error: unknown,
  completion: ListCompletion,
): RouteNotesResult {
  if (!completion.context.isCurrentNotesRequest(completion.requestSequence)) {
    recordListResult(completion.evidence, { staleCompletion: staleFailed });
    return { status: "failed" };
  }
  recordListResult(completion.evidence, { error });
  completion.context.set({
    notesState: { message: getErrorMessage(error), status: "error" },
  });
  return { status: "failed" };
}

function readReadyNotes(context: StoreContext): RouteNotesResult | undefined {
  const notesState = context.get().notesState;
  return notesState.status === "ready"
    ? { noteIds: notesState.data.map((note) => note.id), status: "ready" }
    : undefined;
}

async function applyIncoherentRoute(
  input: RouteStoreApplyInput,
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  if (input.noteId === undefined) {
    return applyEmptyRoute(input.location, context)
      ? {
          requestSequence: undefined,
          status: "applied",
          view: "empty",
        }
      : { reason: "store_apply_failed", status: "failed" };
  }
  return await applyNoteRoute({ ...input, noteId: input.noteId }, context);
}

async function applyNoteRoute(
  input: RouteStoreApplyInput & { readonly noteId: string },
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  const readInput = {
    authorization: input.authorization,
    location: input.location,
    noteId: input.noteId,
    routeSource: input.cause,
  };
  return isNoteInReadyList(input.noteId, context)
    ? await readAuthorizedNote(readInput, context)
    : await recoverMissingAuthorizedRoute(readInput, context);
}

function isNoteInReadyList(noteId: string, context: StoreContext): boolean {
  const notesState = context.get().notesState;
  return (
    notesState.status === "ready" &&
    notesState.data.some((note) => note.id === noteId)
  );
}

/** Forces a fresh same-note read without route or history ownership. */
export async function reloadSelectedNoteAction(
  context: StoreContext,
): Promise<RouteStoreApplyResult> {
  const target = getExplicitReloadTarget(context);
  if (target === undefined) {
    return { status: "stale" };
  }
  return await readAuthorizedNote(
    {
      authorization: {
        authorizationKey: `explicit-reload-${String(context.nextNoteRequestSequence())}`,
        kind: "explicit_reload",
        source: "draft_discard_reload",
      },
      forceReload: true,
      location: target.location,
      noteId: target.noteId,
      routeSource: noteRouteSources.draftDiscardReload,
    },
    context,
  );
}

function getExplicitReloadTarget(context: StoreContext):
  | {
      readonly location: NonNullable<
        ReturnType<StoreContext["get"]>["committedRouteView"]
      >["location"];
      readonly noteId: string;
    }
  | undefined {
  const snapshot = context.get();
  if (snapshot.selectedNoteId === undefined) {
    return undefined;
  }
  const location = getCommittedLocation(snapshot.committedRouteView);
  return location === undefined
    ? undefined
    : { location, noteId: snapshot.selectedNoteId };
}

function getCommittedLocation(
  view: ReturnType<StoreContext["get"]>["committedRouteView"],
) {
  return view?.location;
}
