import type { RouteStoreApplyResult } from "../src/routing/route-store-executor.js";
import type {
  RouteGateCause,
  ValidatedLocationOccurrence,
} from "../src/routing/route-transition-types.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";

let testIntentIdentity = 0;
const testRouteIndexes = new WeakMap<object, number>();

/** Applies one test route through the same authorization seam as production. */
export async function selectTestNote(
  store: ReturnType<typeof createNoteBrowserStore>,
  noteId: string,
  cause: RouteGateCause = "note_list",
): Promise<RouteStoreApplyResult> {
  await store.getState().flushPendingDraft();
  const routeIndex = (testRouteIndexes.get(store) ?? 0) + 1;
  testRouteIndexes.set(store, routeIndex);
  return await applyTestOccurrence({
    cause,
    location: createTestOccurrence(noteId, routeIndex),
    noteId,
    store,
  });
}

/** Loads notes and applies an initial or explicit URL target for store tests. */
export async function loadTestRoute(
  store: ReturnType<typeof createNoteBrowserStore>,
  routeNoteId: string | undefined,
  navigation?: { readonly replaceSelectedNote: (noteId: string) => void },
): Promise<void> {
  const notes = await store.getState().ensureNotes();
  if (notes.status !== "ready") {
    return;
  }
  const noteId = selectRouteTarget(routeNoteId, notes.noteIds);
  notifyStartupReplacement(routeNoteId, noteId, navigation);
  await applyTestOccurrence({
    cause: getInitialRouteCause(routeNoteId),
    location: createTestOccurrence(noteId, 0),
    noteId,
    store,
  });
}

/** Applies a URL echo only when the notes list is already ready. */
export async function syncTestRoute(
  store: ReturnType<typeof createNoteBrowserStore>,
  routeNoteId: string | undefined,
): Promise<void> {
  if (store.getState().notesState.status !== "ready") {
    return;
  }
  await applyTestOccurrence({
    cause: "url_sync",
    location: createTestOccurrence(routeNoteId, 0),
    noteId: routeNoteId,
    store,
  });
}

/** Creates one deterministic validated occurrence for store-level tests. */
export function createTestOccurrence(
  noteId: string | undefined,
  index: number,
): ValidatedLocationOccurrence {
  const search = noteId === undefined ? {} : { note: noteId };
  return {
    generation: index + 1,
    hash: "",
    historyIndex: index,
    historyKey: `test-history-${String(index)}`,
    href: createTestHref(noteId),
    pathname: "/",
    search,
  };
}

async function applyTestOccurrence(input: {
  readonly cause: RouteGateCause;
  readonly location: ValidatedLocationOccurrence;
  readonly noteId: string | undefined;
  readonly store: ReturnType<typeof createNoteBrowserStore>;
}): Promise<RouteStoreApplyResult> {
  testIntentIdentity += 1;
  const intentKey = `test-intent-${String(testIntentIdentity)}`;
  input.store.getState().activateRouteIntent(intentKey);
  return await input.store.getState().applyRoute({
    authorization: {
      authorizationKey: `${intentKey}:authorization`,
      intentKey,
      kind: "route_intent",
    },
    cause: input.cause,
    location: input.location,
    noteId: input.noteId,
  });
}

function notifyStartupReplacement(
  routeNoteId: string | undefined,
  selectedNoteId: string | undefined,
  navigation:
    { readonly replaceSelectedNote: (noteId: string) => void } | undefined,
): void {
  if (routeNoteId !== undefined) {
    return;
  }
  notifySelectedStartupNote(selectedNoteId, navigation);
}

function notifySelectedStartupNote(
  selectedNoteId: string | undefined,
  navigation:
    { readonly replaceSelectedNote: (noteId: string) => void } | undefined,
): void {
  if (selectedNoteId === undefined) {
    return;
  }
  navigation?.replaceSelectedNote(selectedNoteId);
}

function selectRouteTarget(
  routeNoteId: string | undefined,
  noteIds: readonly string[],
): string | undefined {
  return routeNoteId ?? noteIds[0];
}

function getInitialRouteCause(routeNoteId: string | undefined): RouteGateCause {
  return routeNoteId === undefined ? "startup_fallback" : "url_sync";
}

function createTestHref(noteId: string | undefined): string {
  return noteId === undefined ? "/" : `/?note=${encodeURIComponent(noteId)}`;
}
