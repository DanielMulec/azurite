import type { ApiRequestMetadata } from "@azurite/shared";

import type { DraftPersistenceCoordinator } from "../persistence/draft-persistence-coordinator.js";
import type {
  RouteNotesResult,
  RouteStoreApplyResult,
} from "../routing/route-store-executor.js";
import type { NoteLoadAuthorization } from "../routing/route-transition-types.js";
import type {
  NoteBrowserApi,
  NoteBrowserStateAccess,
} from "./note-browser-contracts.js";
import {
  createRouteApplicationRollback,
  type RouteApplicationRollback,
} from "./note-browser-route-rollback.js";
import { applyMissingRoute } from "./note-browser-route-state.js";

/** Dependencies shared only by the store-side route, list, and read workflow. */
export type RouteWorkflowAccess = {
  readonly api: NoteBrowserApi;
  readonly draftCoordinator: DraftPersistenceCoordinator;
  readonly state: NoteBrowserStateAccess;
};

/** Ephemeral ownership for one in-flight note load. */
export type ActiveNoteLoad = {
  readonly authorization: NoteLoadAuthorization;
  readonly metadata: ApiRequestMetadata;
  readonly noteId: string;
  readonly promise: Promise<RouteStoreApplyResult>;
  readonly requestSequence: number;
  readonly routeSource: string;
};

/** Ephemeral ownership for the one coalesced notes-list request. */
export type ActiveNotesLoad = {
  readonly promise: Promise<RouteNotesResult>;
  readonly requestSequence: number;
};

/** Mutable state owned exclusively by the route, list, and read workflow. */
export type RouteWorkflowRuntime = {
  activeNoteLoad: ActiveNoteLoad | undefined;
  activeNotesLoad: ActiveNotesLoad | undefined;
  currentRouteIntentKey: string | undefined;
  editorSessionVersion: number;
  noteRequestSequence: number;
  notesRequestSequence: number;
  readonly routeRollback: RouteApplicationRollback;
};

/** Creates an empty private runtime for one store-side route workflow. */
export function createRouteWorkflowRuntime(): RouteWorkflowRuntime {
  return {
    activeNoteLoad: undefined,
    activeNotesLoad: undefined,
    currentRouteIntentKey: undefined,
    editorSessionVersion: 0,
    noteRequestSequence: 0,
    notesRequestSequence: 0,
    routeRollback: createRouteApplicationRollback(),
  };
}

/** Activates one admitted route intent and retires an older active read. */
export function activateRouteIntent(
  intentKey: string,
  runtime: RouteWorkflowRuntime,
): void {
  if (runtime.currentRouteIntentKey === intentKey) {
    return;
  }
  runtime.currentRouteIntentKey = intentKey;
  if (runtime.activeNoteLoad !== undefined) {
    nextNoteRequestSequence(runtime);
  }
}

/** Allocates a deterministic editor-session identity within the route workflow. */
export function allocateEditorSessionKey(
  noteId: string,
  contentHash: string,
  runtime: RouteWorkflowRuntime,
): string {
  runtime.editorSessionVersion += 1;
  return `${noteId}:${contentHash}:${String(runtime.editorSessionVersion)}`;
}

/** Returns whether a note completion still owns the exact current route request. */
export function isCurrentNoteRequest(
  input: {
    readonly authorization: NoteLoadAuthorization;
    readonly noteId: string;
    readonly requestSequence: number;
  },
  access: RouteWorkflowAccess,
  runtime: RouteWorkflowRuntime,
): boolean {
  if (
    input.requestSequence !== runtime.noteRequestSequence ||
    access.state.getState().selectedNoteId !== input.noteId
  ) {
    return false;
  }
  return isCurrentAuthorization(input.authorization, runtime);
}

/** Advances the note-read sequence owned by the route workflow. */
export function nextNoteRequestSequence(runtime: RouteWorkflowRuntime): number {
  runtime.noteRequestSequence += 1;
  return runtime.noteRequestSequence;
}

/** Advances the notes-list sequence owned by the route workflow. */
export function nextNotesRequestSequence(
  runtime: RouteWorkflowRuntime,
): number {
  runtime.notesRequestSequence += 1;
  return runtime.notesRequestSequence;
}

/** Dismisses a missing draft without changing route or history ownership. */
export function dismissMissingDraft(
  noteId: string,
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): void {
  const location = state.getState().committedRouteView?.location;
  if (location === undefined) {
    state.setState({ noteState: { noteId, status: "missing" } });
    return;
  }
  applyMissingRoute({ location, noteId }, state, commitRouteApplication);
}

/** Publishes the route owner's visible history-confirmation degradation. */
export function reportHistoryUnavailable(state: NoteBrowserStateAccess): void {
  state.setState({
    routeHistoryStatus: {
      message:
        "Browser history could not confirm the previous note. Retry navigation from the current page.",
      reason: "route_history_unavailable",
      status: "degraded",
    },
  });
}

function isCurrentAuthorization(
  authorization: NoteLoadAuthorization,
  runtime: RouteWorkflowRuntime,
): boolean {
  if (authorization.kind === "route_intent") {
    return runtime.currentRouteIntentKey === authorization.intentKey;
  }
  return (
    runtime.activeNoteLoad?.authorization.authorizationKey ===
    authorization.authorizationKey
  );
}
