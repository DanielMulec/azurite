import {
  apiErrorCodes,
  runtimeObservabilityAttributeNames as attributeNames,
  runtimeObservabilityEventNames as eventNames,
  runtimeResultStatuses as results,
  runtimeSpanOperations,
  staleCompletionStatuses,
  type ApiRequestMetadata,
  type ClusterIdentity,
  type RuntimeObservabilityAttributes,
  type RuntimeObservabilityEvent,
  type RuntimeSpanName,
} from "@azurite/shared";

import {
  recordWebRuntimeEvent,
  runWebRuntimeSpan,
} from "../observability/web-runtime-observability.js";

/**
 *
 */
/** Immutable closure-owned identity and start context for one browser operation. */
export type BrowserOperationEvidence = {
  readonly expectedContentHash?: string;
  readonly metadata: ApiRequestMetadata;
  readonly noteId?: string;
  readonly requestSequence?: number;
  readonly routeSource?: string;
  readonly startedAt: number;
};

/** Creates immutable closure evidence for one browser semantic operation. */
export function createBrowserOperationEvidence(
  input: Omit<BrowserOperationEvidence, "startedAt">,
): BrowserOperationEvidence {
  return Object.freeze({ ...input, startedAt: performance.now() });
}

/** Records one browser list lifecycle result with closure-owned identity. */
export function recordListResult(
  evidence: BrowserOperationEvidence,
  outcome:
    | { readonly clusterIdentity: ClusterIdentity; readonly noteCount: number }
    | { readonly error: unknown }
    | { readonly staleCompletion: "failed" | "succeeded" },
): void {
  if ("staleCompletion" in outcome) {
    record(evidence, eventNames.notesListStaleIgnored, results.staleIgnored, {
      [attributeNames.staleCompletion]: outcome.staleCompletion,
    });
    return;
  }
  if ("error" in outcome) {
    record(evidence, eventNames.notesListFailed, results.failed, {
      [attributeNames.apiErrorCode]: readApiErrorCode(outcome.error),
    });
    return;
  }
  record(evidence, eventNames.notesListSucceeded, results.succeeded, {
    ...clusterAttributes(outcome.clusterIdentity),
    [attributeNames.noteCount]: outcome.noteCount,
  });
}

/** Records one browser load lifecycle result with closure-owned identity. */
export function recordLoadResult(
  evidence: BrowserOperationEvidence,
  outcome:
    | {
        readonly clusterIdentity: ClusterIdentity;
        readonly contentHash: string;
        readonly markdownLength: number;
      }
    | { readonly error: unknown }
    | { readonly staleCompletion: "failed" | "succeeded" },
): void {
  if ("staleCompletion" in outcome) {
    record(evidence, eventNames.noteLoadStaleIgnored, results.staleIgnored, {
      [attributeNames.staleCompletion]: outcome.staleCompletion,
    });
    return;
  }
  if ("error" in outcome) {
    record(evidence, eventNames.noteLoadFailed, results.failed, {
      [attributeNames.apiErrorCode]: readApiErrorCode(outcome.error),
    });
    return;
  }
  record(evidence, eventNames.noteLoadSucceeded, results.succeeded, {
    ...clusterAttributes(outcome.clusterIdentity),
    [attributeNames.contentHash]: outcome.contentHash,
    [attributeNames.markdownLength]: outcome.markdownLength,
  });
}

/** Records one browser save lifecycle result with closure-owned identity. */
export function recordSaveResult(
  evidence: BrowserOperationEvidence,
  outcome:
    | {
        readonly clusterIdentity: ClusterIdentity;
        readonly contentHash: string;
      }
    | { readonly error: unknown },
): void {
  if (!("error" in outcome)) {
    record(evidence, eventNames.noteSaveSucceeded, results.succeeded, {
      ...clusterAttributes(outcome.clusterIdentity),
      [attributeNames.contentHash]: outcome.contentHash,
    });
    return;
  }
  const code = readApiErrorCode(outcome.error);
  const conflicted = code === apiErrorCodes.noteWriteConflict;
  record(
    evidence,
    conflicted ? eventNames.noteSaveConflicted : eventNames.noteSaveFailed,
    conflicted ? results.conflicted : results.failed,
    { [attributeNames.apiErrorCode]: code },
  );
}

/** Records a truthful browser route fact without creating operation identity. */
export function recordRouteEvidence(
  eventName: string,
  noteId: string | undefined,
  routeSource: string,
): void {
  recordWebRuntimeEvent({
    attributes: {
      [attributeNames.noteId]: noteId,
      [attributeNames.routeSource]: routeSource,
    },
    name: eventName,
    surface: "web",
  });
}

/** Records an operation start and runs work inside its neutral semantic span. */
export function runBrowserOperation<Result>(
  evidence: BrowserOperationEvidence,
  eventName: string,
  spanName: RuntimeSpanName,
  startAttributes: RuntimeObservabilityAttributes,
  callback: () => Result,
): Result {
  const attributes = baseAttributes(evidence, {
    ...startAttributes,
    [attributeNames.resultStatus]: results.started,
  });
  recordWebRuntimeEvent(createEvent(evidence, eventName, attributes));
  return runWebRuntimeSpan(
    {
      attributes,
      name: eventName,
      spanName,
      spanOperation: runtimeSpanOperations.noteOperation,
      surface: "web",
    },
    callback,
  );
}

/** Canonical success marker for stale completion call sites. */
export const staleSucceeded = staleCompletionStatuses.succeeded;
/** Canonical failure marker for stale completion call sites. */
export const staleFailed = staleCompletionStatuses.failed;

function record(
  evidence: BrowserOperationEvidence,
  name: string,
  resultStatus: string,
  attributes: RuntimeObservabilityAttributes,
): void {
  recordWebRuntimeEvent(
    createEvent(
      evidence,
      name,
      baseAttributes(evidence, {
        ...attributes,
        [attributeNames.durationMs]: Math.max(
          0,
          performance.now() - evidence.startedAt,
        ),
        [attributeNames.resultStatus]: resultStatus,
      }),
    ),
  );
}

function baseAttributes(
  evidence: BrowserOperationEvidence,
  attributes: RuntimeObservabilityAttributes,
): RuntimeObservabilityAttributes {
  return {
    ...attributes,
    [attributeNames.noteId]: evidence.noteId,
    [attributeNames.noteOperationId]: evidence.metadata.noteOperationId,
    [attributeNames.requestId]: evidence.metadata.requestId,
    [attributeNames.routeSource]: evidence.routeSource,
    [attributeNames.expectedContentHash]: evidence.expectedContentHash,
    [attributeNames.uiRequestSequence]: evidence.requestSequence,
  };
}

function createEvent(
  evidence: BrowserOperationEvidence,
  name: string,
  attributes: RuntimeObservabilityAttributes,
): RuntimeObservabilityEvent {
  const apiCode = attributes[attributeNames.apiErrorCode];
  const result = attributes[attributeNames.resultStatus];
  return {
    attributes,
    name,
    surface: "web",
    tags: {
      ...(typeof apiCode === "string"
        ? { [attributeNames.apiErrorCode]: apiCode }
        : {}),
      ...(evidence.metadata.noteOperationId === undefined
        ? {}
        : {
            [attributeNames.noteOperationId]: evidence.metadata.noteOperationId,
          }),
      ...(evidence.metadata.requestId === undefined
        ? {}
        : { [attributeNames.requestId]: evidence.metadata.requestId }),
      ...(typeof result === "string"
        ? { [attributeNames.resultStatus]: result }
        : {}),
    },
  };
}

function clusterAttributes(
  identity: ClusterIdentity,
): RuntimeObservabilityAttributes {
  return identity.status === "ready"
    ? {
        [attributeNames.clusterId]: identity.clusterId,
        [attributeNames.clusterIdentityStatus]: identity.status,
      }
    : {
        [attributeNames.clusterIdentityReason]: identity.reason,
        [attributeNames.clusterIdentityStatus]: identity.status,
      };
}

function readApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const code = (error as Error & { readonly code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
