import type { RouteStoreApplyResult } from "../routing/route-store-executor.js";
import type { ValidatedLocationOccurrence } from "../routing/route-transition-types.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  readRouteDraft,
  type RouteDraftApplication,
} from "./note-browser-route-drafts.js";
import {
  applyMissingDraftRoute,
  applyMissingRoute,
} from "./note-browser-route-state.js";

type MissingRouteReadInput = {
  readonly context: StoreContext;
  readonly isCurrent: () => boolean;
  readonly location: ValidatedLocationOccurrence;
  readonly noteId: string;
  readonly requestSequence: number;
};

/** Resolves a missing note and optional browser draft as one terminal route view. */
export async function applyMissingRouteRead(
  input: MissingRouteReadInput,
): Promise<RouteStoreApplyResult> {
  const application = await readRouteDraft(input.noteId, input.context);
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
    input.context,
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
  const renderedOwnerKey = input.context.nextEditorSessionKey(
    input.noteId,
    "missing-draft",
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
    input.context,
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
