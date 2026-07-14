import type { ClusterIdentity } from "@azurite/shared";

import type { DraftRecord } from "../persistence/draft-records.js";
import type { DraftPersistenceCoordinator } from "../persistence/draft-persistence-coordinator.js";
import type {
  DraftDisposition,
  DraftFailureDetail,
} from "../persistence/draft-workflow-types.js";
import {
  getDegradedDraftRecoveryStatus,
  getReadyClusterId,
} from "./note-browser-action-utils.js";
import type { NoteBrowserStore } from "./note-browser-contracts.js";

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
  draftCoordinator: DraftPersistenceCoordinator,
): Promise<RouteDraftApplication> {
  const clusterId = getReadyClusterId(clusterIdentity);
  if (clusterId === undefined) {
    return unavailableIdentityApplication(clusterIdentity);
  }
  const result = await draftCoordinator.readDraft(clusterId, noteId);
  if (result.status === "failed") {
    return getFailedDraftApplication(clusterId, result.failure);
  }
  if (result.status === "protected") {
    return getProtectedDraftApplication(clusterId, result.schemaVersion);
  }
  if (result.status === "current") {
    return {
      clusterId,
      disposition: "recovered",
      draft: result.draft,
      failure: undefined,
      preservedSchemaVersion: undefined,
      statePatch: {},
    };
  }
  return getAbsentDraftApplication(clusterId, result.failure);
}

function unavailableIdentityApplication(
  clusterIdentity: ClusterIdentity,
): RouteDraftApplication {
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

function getFailedDraftApplication(
  clusterId: string,
  failure: DraftFailureDetail,
): RouteDraftApplication {
  return {
    clusterId,
    disposition: "recovery_read_unavailable",
    draft: undefined,
    failure,
    preservedSchemaVersion: undefined,
    statePatch:
      failure.source === "persistence"
        ? {
            draftRecoveryStatus: getDegradedDraftRecoveryStatus(failure.reason),
          }
        : {},
  };
}

function getProtectedDraftApplication(
  clusterId: string,
  schemaVersion: number,
): RouteDraftApplication {
  return {
    clusterId,
    disposition: "preserved_unknown",
    draft: undefined,
    failure: { reason: "preserved_unknown", source: "record" },
    preservedSchemaVersion: schemaVersion,
    statePatch: {},
  };
}

function getAbsentDraftApplication(
  clusterId: string,
  failure: DraftFailureDetail | undefined,
): RouteDraftApplication {
  return {
    clusterId,
    disposition: "none",
    draft: undefined,
    failure,
    preservedSchemaVersion: undefined,
    statePatch:
      failure?.source === "persistence"
        ? {
            draftRecoveryStatus:
              getDegradedDraftRecoveryStatus("validation_failed"),
          }
        : {},
  };
}
