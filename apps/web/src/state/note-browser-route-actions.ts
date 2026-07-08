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
  isSelectedNoteReady,
  keepRenderedNoteWhileLoading,
} from "./note-browser-action-utils.js";
import type {
  RouteNavigation,
  StoreContext,
} from "./note-browser-contracts.js";

type SelectNoteOptions = {
  readonly forceReload?: boolean;
};

type RouteSyncInput = {
  readonly context: StoreContext;
  readonly navigation: RouteNavigation;
  readonly notes: readonly { readonly id: string }[];
  readonly routeNoteId: string | undefined;
};

type SelectedNoteRequest = {
  readonly context: StoreContext;
  readonly noteId: string;
  readonly requestId: number;
};

type DraftLookupResult =
  | {
      readonly draft: DraftRecord | undefined;
      readonly status: "ready";
    }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Loads note summaries and synchronizes the selected note from the URL. */
export async function loadNotesAction(
  navigation: RouteNavigation,
  context: StoreContext,
): Promise<void> {
  const requestId = context.nextNotesRequestId();
  context.set({ notesState: { status: "loading" } });

  try {
    const response = await context.api.listNotes();

    if (!context.isCurrentNotesRequest(requestId)) {
      return;
    }

    applyClusterIdentity(response.clusterIdentity, context);
    context.set({ notesState: { data: response.notes, status: "ready" } });
    await syncRouteNoteAction(
      context.getLatestRouteNoteId(),
      navigation,
      context,
    );
  } catch (error) {
    context.set({
      notesState: { message: getErrorMessage(error), status: "error" },
    });
  }
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
export async function selectNoteAction(
  noteId: string,
  context: StoreContext,
  options: SelectNoteOptions = {},
): Promise<void> {
  if (shouldSkipNoteSelection(noteId, context, options)) {
    return;
  }

  const requestId = startNoteLoad(noteId, context);
  await readSelectedNote(noteId, requestId, context);
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

  navigation.replaceSelectedNote(firstNoteId);
  await selectNoteAction(firstNoteId, context);
}

async function syncExplicitRouteNote(
  noteId: string,
  notes: readonly { readonly id: string }[],
  context: StoreContext,
): Promise<void> {
  if (notes.some((note) => note.id === noteId)) {
    await selectNoteAction(noteId, context);
    return;
  }

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
  const requestId = context.nextNoteRequestId();
  context.set((state) => ({
    noteState: keepRenderedNoteWhileLoading(state.noteState),
    selectedNoteId: noteId,
  }));

  return requestId;
}

async function readSelectedNote(
  noteId: string,
  requestId: number,
  context: StoreContext,
): Promise<void> {
  try {
    const response = await context.api.readNote(noteId);
    await applySelectedNoteResponse(response, { context, noteId, requestId });
  } catch (error) {
    await applySelectedNoteFailure(error, { context, noteId, requestId });
  }
}

async function applySelectedNoteResponse(
  response: ReadNoteResponse,
  request: SelectedNoteRequest,
): Promise<void> {
  if (
    !request.context.isCurrentNoteRequest(request.requestId, request.noteId)
  ) {
    return;
  }

  applyClusterIdentity(response.clusterIdentity, request.context);
  await applyLoadedNote(response.note, request.requestId, request.context);
}

async function applySelectedNoteFailure(
  error: unknown,
  request: SelectedNoteRequest,
): Promise<void> {
  if (
    !request.context.isCurrentNoteRequest(request.requestId, request.noteId)
  ) {
    return;
  }

  await applyCurrentSelectedNoteFailure(error, request);
}

async function applyCurrentSelectedNoteFailure(
  error: unknown,
  request: SelectedNoteRequest,
): Promise<void> {
  if (isNoteNotFoundError(error)) {
    await applyMissingNoteDraft(request);
    return;
  }

  request.context.set({
    noteState: { message: getErrorMessage(error), status: "error" },
  });
}

async function applyLoadedNote(
  note: NoteContentWithHash,
  requestId: number,
  context: StoreContext,
): Promise<void> {
  const draftLookup = await readDraftForCurrentCluster(note.id, context);

  if (!context.isCurrentNoteRequest(requestId, note.id)) {
    return;
  }

  const draft = applyDraftLookupResult(draftLookup, context);

  context.set({
    noteState: {
      editor: createEditorSession(note, draft, context),
      status: "ready",
    },
  });
}

async function recoverMissingRouteNote(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  const requestId = startMissingNoteLoad(noteId, context);
  await applyMissingNoteDraft({ context, noteId, requestId });
}

function startMissingNoteLoad(noteId: string, context: StoreContext): number {
  const requestId = context.nextNoteRequestId();
  context.set((state) => ({
    noteState: keepRenderedNoteWhileLoading(state.noteState),
    selectedNoteId: noteId,
  }));

  return requestId;
}

async function applyMissingNoteDraft(
  request: SelectedNoteRequest,
): Promise<void> {
  const draftLookup = await readDraftForCurrentCluster(
    request.noteId,
    request.context,
  );

  if (
    !request.context.isCurrentNoteRequest(request.requestId, request.noteId)
  ) {
    return;
  }

  const draft = applyDraftLookupResult(draftLookup, request.context);

  if (draft === undefined) {
    request.context.set({
      noteState: { noteId: request.noteId, status: "missing" },
      selectedNoteId: request.noteId,
    });
    return;
  }

  request.context.set({
    noteState: {
      draft: {
        editorMode: draft.editorMode,
        markdown: draft.markdown,
        updatedAt: draft.updatedAt,
      },
      noteId: request.noteId,
      status: "missing-draft",
    },
    selectedNoteId: request.noteId,
  });
}

async function readDraftForCurrentCluster(
  noteId: string,
  context: StoreContext,
): Promise<DraftLookupResult> {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);

  if (clusterId === undefined) {
    return { draft: undefined, status: "ready" };
  }

  const result = await context.draftPersistence.readDraft(clusterId, noteId);

  return toDraftLookupResult(result);
}

function toDraftLookupResult(result: DraftReadResult): DraftLookupResult {
  if (result.status === "unavailable") {
    return { reason: result.reason, status: "unavailable" };
  }

  return { draft: result.draft, status: "ready" };
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
