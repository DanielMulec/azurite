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
    return unavailableIdentityApplication(clusterIdentity);
  }
  const result = await context.draftCoordinator.readDraft(clusterId, noteId);
  return isFailedDraftRead(result)
    ? getFailedDraftApplication(clusterId, result)
    : getReadableDraftApplication(clusterId, result);
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
  result: Extract<
    Awaited<ReturnType<StoreContext["draftCoordinator"]["readDraft"]>>,
    { status: "queue_failed" | "unavailable" }
  >,
): RouteDraftApplication {
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
  return {
    clusterId,
    disposition: "recovery_read_unavailable",
    draft: undefined,
    failure: { reason: result.reason, source: "coordinator" },
    preservedSchemaVersion: undefined,
    statePatch: {},
  };
}

function isFailedDraftRead(
  result: Awaited<ReturnType<StoreContext["draftCoordinator"]["readDraft"]>>,
): result is Extract<
  Awaited<ReturnType<StoreContext["draftCoordinator"]["readDraft"]>>,
  { status: "queue_failed" | "unavailable" }
> {
  return result.status === "queue_failed" || result.status === "unavailable";
}

function getReadableDraftApplication(
  clusterId: string,
  result: Exclude<
    Awaited<ReturnType<StoreContext["draftCoordinator"]["readDraft"]>>,
    { status: "queue_failed" | "unavailable" }
  >,
): RouteDraftApplication {
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
  return getAbsentDraftApplication(clusterId, result);
}

function getAbsentDraftApplication(
  clusterId: string,
  result: Extract<
    Awaited<ReturnType<StoreContext["draftCoordinator"]["readDraft"]>>,
    { status: "absent" | "invalid_deleted" }
  >,
): RouteDraftApplication {
  const invalid = result.status === "invalid_deleted";
  return {
    clusterId,
    disposition: "none",
    draft: undefined,
    failure: invalid
      ? { reason: "validation_failed", source: "persistence" }
      : undefined,
    preservedSchemaVersion: undefined,
    statePatch: invalid
      ? {
          draftRecoveryStatus:
            getDegradedDraftRecoveryStatus("validation_failed"),
        }
      : {},
  };
}
