import type { DraftRecord } from "../persistence/draft-records.js";
import {
  getDegradedDraftRecoveryStatus,
  getReadyClusterId,
} from "./note-browser-action-utils.js";
import type {
  NoteBrowserStore,
  StoreContext,
} from "./note-browser-contracts.js";

/** Draft lookup result prepared for one atomic terminal route mutation. */
export type RouteDraftApplication = {
  readonly draft: DraftRecord | undefined;
  readonly statePatch: Partial<Pick<NoteBrowserStore, "draftRecoveryStatus">>;
};

/** Reads a route draft without mutating state before the terminal view commits. */
export async function readRouteDraft(
  noteId: string,
  context: StoreContext,
): Promise<RouteDraftApplication> {
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    return { draft: undefined, statePatch: {} };
  }
  const result = await context.draftPersistence.readDraft(clusterId, noteId);
  if (result.status === "unavailable") {
    return {
      draft: undefined,
      statePatch: {
        draftRecoveryStatus: getDegradedDraftRecoveryStatus(result.reason),
      },
    };
  }
  return { draft: result.draft, statePatch: {} };
}
