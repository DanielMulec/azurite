import type { NoteContentWithHash, ReadNoteResponse } from "@azurite/shared";

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

/** Loads note summaries and synchronizes the selected note from the URL. */
export async function loadNotesAction(
  routeNoteId: string | undefined,
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
    await syncRouteNoteAction(routeNoteId, navigation, context);
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

  await applyMissingNoteDraft(noteId, context);
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

  await applyCurrentSelectedNoteFailure(error, request.noteId, request.context);
}

async function applyCurrentSelectedNoteFailure(
  error: unknown,
  noteId: string,
  context: StoreContext,
): Promise<void> {
  if (isNoteNotFoundError(error)) {
    await applyMissingNoteDraft(noteId, context);
    return;
  }

  context.set({
    noteState: { message: getErrorMessage(error), status: "error" },
  });
}

async function applyLoadedNote(
  note: NoteContentWithHash,
  requestId: number,
  context: StoreContext,
): Promise<void> {
  const draft = await readDraftForCurrentCluster(note.id, context);

  if (!context.isCurrentNoteRequest(requestId, note.id)) {
    return;
  }

  context.set({
    noteState: {
      editor: createEditorSession(note, draft, context),
      status: "ready",
    },
  });
}

async function applyMissingNoteDraft(
  noteId: string,
  context: StoreContext,
): Promise<void> {
  const draft = await readDraftForCurrentCluster(noteId, context);

  if (draft === undefined) {
    context.set({
      noteState: { noteId, status: "missing" },
      selectedNoteId: noteId,
    });
    return;
  }

  context.set({
    noteState: {
      draft: {
        editorMode: draft.editorMode,
        markdown: draft.markdown,
        updatedAt: draft.updatedAt,
      },
      noteId,
      status: "missing-draft",
    },
    selectedNoteId: noteId,
  });
}

async function readDraftForCurrentCluster(
  noteId: string,
  context: StoreContext,
): Promise<DraftRecord | undefined> {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);

  if (clusterId === undefined) {
    return undefined;
  }

  const result = await context.draftPersistence.readDraft(clusterId, noteId);

  if (result.status === "unavailable") {
    degradeDraftRecovery(result.reason, context);
    return undefined;
  }

  return result.draft;
}
