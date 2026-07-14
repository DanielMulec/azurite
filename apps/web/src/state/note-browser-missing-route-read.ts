import type { RouteStoreApplyResult } from "../routing/route-store-executor.js";
import type { ValidatedLocationOccurrence } from "../routing/route-transition-types.js";
import {
  readRouteDraft,
  type RouteDraftApplication,
} from "./note-browser-route-drafts.js";
import {
  applyMissingDraftRoute,
  applyMissingRoute,
} from "./note-browser-route-state.js";
import {
  allocateEditorSessionKey,
  type RouteWorkflowAccess,
  type RouteWorkflowRuntime,
} from "./note-browser-route-runtime.js";

type MissingRouteReadInput = {
  readonly access: RouteWorkflowAccess;
  readonly isCurrent: () => boolean;
  readonly location: ValidatedLocationOccurrence;
  readonly noteId: string;
  readonly requestSequence: number;
  readonly runtime: RouteWorkflowRuntime;
};

/** Resolves a missing note and optional browser draft as one terminal route view. */
export async function applyMissingRouteRead(
  input: MissingRouteReadInput,
): Promise<RouteStoreApplyResult> {
  const application = await readRouteDraft(
    input.noteId,
    getMissingRouteClusterIdentity(input.access),
    input.access.draftCoordinator,
  );
  if (!input.isCurrent()) {
    return { status: "stale" };
  }
  return application.draft === undefined
    ? applyMissingWithoutDraft(input, application)
    : applyRecoveredMissingDraft(
        input,
        application.draft,
        application.statePatch,
      );
}

function getMissingRouteClusterIdentity(access: RouteWorkflowAccess) {
  return (
    access.state.getState().clusterIdentity ?? {
      reason: "metadata_unavailable" as const,
      status: "unavailable" as const,
    }
  );
}

function applyMissingWithoutDraft(
  input: MissingRouteReadInput,
  application: RouteDraftApplication,
): RouteStoreApplyResult {
  const applied = applyMissingRoute(
    {
      location: input.location,
      noteId: input.noteId,
      statePatch: application.statePatch,
    },
    input.access.state,
    input.runtime.routeRollback.commit,
  );
  return applied
    ? {
        requestSequence: input.requestSequence,
        status: "applied",
        view: "missing",
      }
    : storeApplyFailed;
}

function applyRecoveredMissingDraft(
  input: MissingRouteReadInput,
  draft: NonNullable<RouteDraftApplication["draft"]>,
  statePatch: RouteDraftApplication["statePatch"],
): RouteStoreApplyResult {
  const renderedOwnerKey = allocateEditorSessionKey(
    input.noteId,
    "missing-draft",
    input.runtime,
  );
  const applied = applyMissingDraftRoute(
    {
      draft: {
        editorMode: draft.editorMode,
        markdown: draft.markdown,
        updatedAt: draft.updatedAt,
      },
      location: input.location,
      noteId: input.noteId,
      renderedOwnerKey,
      statePatch,
    },
    input.access.state,
    input.runtime.routeRollback.commit,
  );
  return applied
    ? {
        requestSequence: input.requestSequence,
        status: "applied",
        view: "missing_draft",
      }
    : storeApplyFailed;
}

const storeApplyFailed: RouteStoreApplyResult = Object.freeze({
  reason: "store_apply_failed",
  status: "failed",
});
