import {
  noteRouteSources,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeSpanNames,
} from "@azurite/shared";

import {
  applyClusterIdentity,
  getErrorMessage,
  isSelectedNoteReady,
  keepRenderedNoteWhileLoading,
} from "./note-browser-action-utils.js";
import type {
  RouteNavigation,
  StoreContext,
} from "./note-browser-contracts.js";
import {
  createBrowserOperationEvidence,
  recordListResult,
  recordRouteEvidence,
  runBrowserOperation,
  staleFailed,
  staleSucceeded,
  type BrowserOperationEvidence,
} from "./note-browser-evidence.js";
import {
  createNoteRequestMetadata,
  createRequestMetadata,
} from "./note-operation-metadata.js";
import {
  readSelectedNote,
  recoverMissingRouteNote,
} from "./note-browser-read-actions.js";

type SelectNoteOptions = {
  readonly forceReload?: boolean;
  readonly routeSource?: (typeof noteRouteSources)[keyof typeof noteRouteSources];
};

type RouteSyncInput = {
  readonly context: StoreContext;
  readonly navigation: RouteNavigation;
  readonly notes: readonly { readonly id: string }[];
  readonly routeNoteId: string | undefined;
};

/** Loads note summaries and synchronizes the selected note from the URL. */
export async function loadNotesAction(
  navigation: RouteNavigation,
  context: StoreContext,
): Promise<void> {
  const requestSequence = context.nextNotesRequestSequence();
  const metadata = createRequestMetadata();
  const evidence = createBrowserOperationEvidence({
    metadata,
    requestSequence,
  });
  context.set({ notesState: { status: "loading" } });
  return runBrowserOperation({
    callback: async () => {
      try {
        const response = await context.api.listNotes(metadata);
        if (!applyListSuccess(response, evidence, requestSequence, context)) {
          return;
        }
        await syncRouteNoteAction(
          context.getLatestRouteNoteId(),
          navigation,
          context,
        );
      } catch (error) {
        applyListFailure(error, evidence, requestSequence, context);
      }
    },
    evidence,
    eventName: runtimeObservabilityEventNames.notesListStarted,
    spanName: runtimeSpanNames.notesList,
    startAttributes: {},
  });
}

/** Synchronizes the selected-note state from typed route search params. */
export async function syncRouteNoteAction(
  routeNoteId: string | undefined,
  navigation: RouteNavigation,
  context: StoreContext,
): Promise<void> {
  const notesState = context.get().notesState;

  if (notesState.status !== "ready") {
    return;
  }

  await syncReadyRouteNote({
    context,
    navigation,
    notes: notesState.data,
    routeNoteId,
  });
}

/** Selects and loads one note while guarding against stale responses. */
export function selectNoteAction(
  noteId: string,
  context: StoreContext,
  options: SelectNoteOptions = {},
): Promise<void> {
  const coalescedPromise = getCoalescedLoadPromise(noteId, options, context);
  if (coalescedPromise !== undefined) {
    return coalescedPromise;
  }

  if (shouldSkipNoteSelection(noteId, context, options)) {
    return Promise.resolve();
  }

  const requestSequence = startNoteLoad(noteId, context);
  const metadata = createNoteRequestMetadata();
  const routeSource = options.routeSource ?? noteRouteSources.noteList;
  recordSelectionRoute(noteId, routeSource);
  const evidence = createBrowserOperationEvidence({
    metadata,
    noteId,
    requestSequence,
    routeSource,
  });
  const promise = runBrowserOperation({
    callback: () => readSelectedNote(evidence, context),
    evidence,
    eventName: runtimeObservabilityEventNames.noteLoadStarted,
    spanName: runtimeSpanNames.noteLoad,
    startAttributes: {
      [runtimeObservabilityAttributeNames.routeSource]: routeSource,
    },
  }).finally(() => {
    context.clearActiveNoteLoad(promise);
  });
  context.setActiveNoteLoad({
    metadata,
    noteId,
    promise,
    requestSequence,
    routeSource,
  });
  return promise;
}

function getCoalescedLoadPromise(
  noteId: string,
  options: SelectNoteOptions,
  context: StoreContext,
): Promise<void> | undefined {
  if (options.forceReload === true) {
    return undefined;
  }
  return context.getActiveNoteLoad(noteId)?.promise;
}

async function syncReadyRouteNote(input: RouteSyncInput): Promise<void> {
  if (input.notes.length === 0) {
    applyEmptyNoteList(input.context);
    return;
  }

  await syncNonEmptyRouteNote(input);
}

async function syncNonEmptyRouteNote(input: RouteSyncInput): Promise<void> {
  if (input.routeNoteId === undefined) {
    await selectStartupNote(input.notes, input.navigation, input.context);
    return;
  }

  await syncExplicitRouteNote(input.routeNoteId, input.notes, input.context);
}

async function selectStartupNote(
  notes: readonly { readonly id: string }[],
  navigation: RouteNavigation,
  context: StoreContext,
): Promise<void> {
  const firstNoteId = notes[0]?.id;

  if (firstNoteId === undefined) {
    return;
  }

  const selection = selectNoteAction(firstNoteId, context, {
    routeSource: noteRouteSources.startupFallback,
  });
  navigation.replaceSelectedNote(firstNoteId);
  await selection;
}

async function syncExplicitRouteNote(
  noteId: string,
  notes: readonly { readonly id: string }[],
  context: StoreContext,
): Promise<void> {
  if (notes.some((note) => note.id === noteId)) {
    await selectNoteAction(noteId, context, {
      routeSource: noteRouteSources.urlSync,
    });
    return;
  }

  recordRouteEvidence(
    runtimeObservabilityEventNames.noteRouteSynchronized,
    noteId,
    noteRouteSources.urlSync,
  );
  await recoverMissingRouteNote(noteId, context);
}

function applyEmptyNoteList(context: StoreContext): void {
  context.set({ noteState: { status: "idle" }, selectedNoteId: undefined });
}

function shouldSkipNoteSelection(
  noteId: string,
  context: StoreContext,
  options: SelectNoteOptions,
): boolean {
  return (
    options.forceReload !== true &&
    isSelectedNoteReady(noteId, context.get().noteState)
  );
}

function startNoteLoad(noteId: string, context: StoreContext): number {
  const requestSequence = context.nextNoteRequestSequence();
  context.set((state) => ({
    noteState: keepRenderedNoteWhileLoading(state.noteState),
    selectedNoteId: noteId,
  }));

  return requestSequence;
}

function recordSelectionRoute(noteId: string, routeSource: string): void {
  const eventName = routeEventNames[routeSource];
  if (eventName === undefined) {
    return;
  }
  recordRouteEvidence(eventName, noteId, routeSource);
}

const routeEventNames: Readonly<Record<string, string | undefined>> = {
  [noteRouteSources.noteList]:
    runtimeObservabilityEventNames.noteRouteNavigationRequested,
  [noteRouteSources.startupFallback]:
    runtimeObservabilityEventNames.noteRouteNavigationRequested,
  [noteRouteSources.urlSync]:
    runtimeObservabilityEventNames.noteRouteSynchronized,
};

function applyListSuccess(
  response: Awaited<ReturnType<StoreContext["api"]["listNotes"]>>,
  evidence: BrowserOperationEvidence,
  requestSequence: number,
  context: StoreContext,
): boolean {
  if (!context.isCurrentNotesRequest(requestSequence)) {
    recordListResult(evidence, { staleCompletion: staleSucceeded });
    return false;
  }
  recordListResult(evidence, {
    clusterIdentity: response.clusterIdentity,
    noteCount: response.notes.length,
  });
  applyClusterIdentity(response.clusterIdentity, context);
  context.set({ notesState: { data: response.notes, status: "ready" } });
  return true;
}

function applyListFailure(
  error: unknown,
  evidence: BrowserOperationEvidence,
  requestSequence: number,
  context: StoreContext,
): void {
  if (!context.isCurrentNotesRequest(requestSequence)) {
    recordListResult(evidence, { staleCompletion: staleFailed });
    return;
  }
  recordListResult(evidence, { error });
  context.set({
    notesState: { message: getErrorMessage(error), status: "error" },
  });
}
