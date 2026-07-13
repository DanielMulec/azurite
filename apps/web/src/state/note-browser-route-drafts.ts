import type { ClusterIdentity } from "@azurite/shared";

import type { DraftRecord } from "../persistence/draft-records.js";
import type {
  DraftDisposition,
  DraftFailureDetail,
} from "../persistence/draft-workflow-types.js";
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
  readonly clusterId: string | undefined;
  readonly draft: DraftRecord | undefined;
  readonly disposition: DraftDisposition;
  readonly failure: DraftFailureDetail | undefined;
  readonly preservedSchemaVersion: number | undefined;
  readonly statePatch: Partial<Pick<NoteBrowserStore, "draftRecoveryStatus">>;
};

/** Reads a route draft without mutating state before the terminal view commits. */
export async function readRouteDraft(
  noteId: string,
  clusterIdentity: ClusterIdentity,
  context: StoreContext,
): Promise<RouteDraftApplication> {
  const clusterId = getReadyClusterId(clusterIdentity);
  if (clusterId === undefined) {
    return {
      clusterId: undefined,
      disposition: "recovery_read_unavailable",
      draft: undefined,
      failure: {
        reason:
          clusterIdentity.status === "unavailable"
            ? clusterIdentity.reason
            : "metadata_unavailable",
        source: "cluster_identity",
      },
      preservedSchemaVersion: undefined,
      statePatch: {
        draftRecoveryStatus: {
          message: "Draft recovery is unavailable for this cluster.",
          reason: "cluster_identity_unavailable",
          status: "degraded",
        },
      },
    };
  }
  const result = await context.draftCoordinator.readDraft(clusterId, noteId);
  if (result.status === "unavailable") {
    return {
      clusterId,
      disposition: "recovery_read_unavailable",
      draft: undefined,
      failure: { reason: result.reason, source: "persistence" },
      preservedSchemaVersion: undefined,
      statePatch: {
        draftRecoveryStatus: getDegradedDraftRecoveryStatus(result.reason),
      },
    };
  }
  if (result.status === "queue_failed") {
    return {
      clusterId,
      disposition: "recovery_read_unavailable",
      draft: undefined,
      failure: { reason: result.reason, source: "coordinator" },
      preservedSchemaVersion: undefined,
      statePatch: {},
    };
  }
  if (result.status === "preserved_unknown") {
    return {
      clusterId,
      disposition: "preserved_unknown",
      draft: undefined,
      failure: { reason: "preserved_unknown", source: "record" },
      preservedSchemaVersion: result.schemaVersion,
      statePatch: {},
    };
  }
  if (result.status === "found_current") {
    return {
      clusterId,
      disposition: "recovered",
      draft: result.draft,
      failure: undefined,
      preservedSchemaVersion: undefined,
      statePatch: {},
    };
  }
  return {
    clusterId,
    disposition: "none",
    draft: undefined,
    failure:
      result.status === "invalid_deleted"
        ? { reason: "validation_failed", source: "persistence" }
        : undefined,
    preservedSchemaVersion: undefined,
    statePatch:
      result.status === "invalid_deleted"
        ? {
            draftRecoveryStatus:
              getDegradedDraftRecoveryStatus("validation_failed"),
          }
        : {},
  };
}
