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
  const routeIndex = (testRouteIndexes.get(store) ?? 0) + 1;
  testRouteIndexes.set(store, routeIndex);
  return await applyTestOccurrence(
    store,
    createTestOccurrence(noteId, routeIndex),
    noteId,
    cause,
  );
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
  const noteId = routeNoteId ?? notes.noteIds[0];
  notifyStartupReplacement(routeNoteId, noteId, navigation);
  await applyTestOccurrence(
    store,
    createTestOccurrence(noteId, 0),
    noteId,
    routeNoteId === undefined ? "startup_fallback" : "url_sync",
  );
}

/** Applies a URL echo only when the notes list is already ready. */
export async function syncTestRoute(
  store: ReturnType<typeof createNoteBrowserStore>,
  routeNoteId: string | undefined,
): Promise<void> {
  if (store.getState().notesState.status !== "ready") {
    return;
  }
  await applyTestOccurrence(
    store,
    createTestOccurrence(routeNoteId, 0),
    routeNoteId,
    "url_sync",
  );
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

async function applyTestOccurrence(
  store: ReturnType<typeof createNoteBrowserStore>,
  location: ValidatedLocationOccurrence,
  noteId: string | undefined,
  cause: RouteGateCause,
): Promise<RouteStoreApplyResult> {
  testIntentIdentity += 1;
  const intentKey = `test-intent-${String(testIntentIdentity)}`;
  store.getState().activateRouteIntent(intentKey);
  return await store.getState().applyRoute({
    authorization: {
      authorizationKey: `${intentKey}:authorization`,
      intentKey,
      kind: "route_intent",
    },
    cause,
    location,
    noteId,
  });
}

function notifyStartupReplacement(
  routeNoteId: string | undefined,
  selectedNoteId: string | undefined,
  navigation: { readonly replaceSelectedNote: (noteId: string) => void } | undefined,
): void {
  if (routeNoteId === undefined && selectedNoteId !== undefined) {
    navigation?.replaceSelectedNote(selectedNoteId);
  }
}

function createTestHref(noteId: string | undefined): string {
  return noteId === undefined ? "/" : `/?note=${encodeURIComponent(noteId)}`;
}
