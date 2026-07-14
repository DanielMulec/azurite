import type {
  RouteStoreApplyResult,
  RouteStoreExecutor,
} from "../routing/route-store-executor.js";
import { retryBrowserRecoveryAction } from "./note-browser-recovery-actions.js";
import {
  applyRouteAction,
  ensureNotesAction,
  reloadSelectedNoteAction,
} from "./note-browser-route-actions.js";
import {
  activateRouteIntent,
  allocateEditorSessionKey,
  createRouteWorkflowRuntime,
  type RouteWorkflowAccess,
} from "./note-browser-route-runtime.js";
import type { NoteBrowserStateAccess } from "./note-browser-contracts.js";
import {
  getCoherentRouteView,
  getRenderedOwnerKey,
} from "./note-browser-route-predicates.js";
import { applyMissingRoute } from "./note-browser-route-state.js";

/** Store-side route operations plus exact dependencies used by other workflows. */
export type NoteBrowserRouteWorkflow = {
  readonly dismissMissingDraft: (noteId: string) => void;
  readonly executor: RouteStoreExecutor;
  readonly reloadSelectedNote: () => Promise<RouteStoreApplyResult>;
  readonly retryBrowserRecovery: () => Promise<void>;
};

/** Creates the private route runtime and its six-operation cross-layer executor. */
export function createNoteBrowserRouteWorkflow(
  access: RouteWorkflowAccess,
): NoteBrowserRouteWorkflow {
  const runtime = createRouteWorkflowRuntime();
  return {
    dismissMissingDraft: (noteId) => {
      dismissMissingDraft(noteId, access.state, runtime.routeRollback.commit);
    },
    executor: {
      activateRouteIntent: (intentKey) => {
        activateRouteIntent(intentKey, runtime);
      },
      applyRoute: (input) => applyRouteAction(input, access, runtime),
      ensureNotes: () => ensureNotesAction(access, runtime),
      getCoherentView: (occurrence, noteId) =>
        getCoherentRouteView(
          { activeLoad: runtime.activeNoteLoad, noteId, occurrence },
          access.state.getState(),
        ),
      getRenderedOwnerKey: () =>
        getRenderedOwnerKey(access.state.getState()),
      reportHistoryUnavailable: () => {
        reportHistoryUnavailable(access.state);
      },
    },
    reloadSelectedNote: async () =>
      await reloadSelectedNoteAction(access, runtime),
    retryBrowserRecovery: async () =>
      await retryBrowserRecoveryAction(access, (noteId, contentHash) =>
        allocateEditorSessionKey(noteId, contentHash, runtime),
      ),
  };
}

function dismissMissingDraft(
  noteId: string,
  state: NoteBrowserStateAccess,
  commitRouteApplication: () => void,
): void {
  const location = state.getState().committedRouteView?.location;
  if (location === undefined) {
    state.setState({ noteState: { noteId, status: "missing" } });
    return;
  }
  applyMissingRoute(
    { location, noteId },
    state,
    commitRouteApplication,
  );
}

function reportHistoryUnavailable(state: NoteBrowserStateAccess): void {
  state.setState({
    routeHistoryStatus: {
      message:
        "Browser history could not confirm the previous note. Retry navigation from the current page.",
      reason: "route_history_unavailable",
      status: "degraded",
    },
  });
}
