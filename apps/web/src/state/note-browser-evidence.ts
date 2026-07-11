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
    record({
      attributes: {
        [attributeNames.staleCompletion]: outcome.staleCompletion,
      },
      evidence,
      name: eventNames.notesListStaleIgnored,
      resultStatus: results.staleIgnored,
    });
    return;
  }
  if ("error" in outcome) {
    record({
      attributes: {
        [attributeNames.apiErrorCode]: readApiErrorCode(outcome.error),
      },
      evidence,
      name: eventNames.notesListFailed,
      resultStatus: results.failed,
    });
    return;
  }
  record({
    attributes: {
      ...clusterAttributes(outcome.clusterIdentity),
      [attributeNames.noteCount]: outcome.noteCount,
    },
    evidence,
    name: eventNames.notesListSucceeded,
    resultStatus: results.succeeded,
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
    record({
      attributes: {
        [attributeNames.staleCompletion]: outcome.staleCompletion,
      },
      evidence,
      name: eventNames.noteLoadStaleIgnored,
      resultStatus: results.staleIgnored,
    });
    return;
  }
  if ("error" in outcome) {
    record({
      attributes: {
        [attributeNames.apiErrorCode]: readApiErrorCode(outcome.error),
      },
      evidence,
      name: eventNames.noteLoadFailed,
      resultStatus: results.failed,
    });
    return;
  }
  record({
    attributes: {
      ...clusterAttributes(outcome.clusterIdentity),
      [attributeNames.contentHash]: outcome.contentHash,
      [attributeNames.markdownLength]: outcome.markdownLength,
    },
    evidence,
    name: eventNames.noteLoadSucceeded,
    resultStatus: results.succeeded,
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
    record({
      attributes: {
        ...clusterAttributes(outcome.clusterIdentity),
        [attributeNames.contentHash]: outcome.contentHash,
      },
      evidence,
      name: eventNames.noteSaveSucceeded,
      resultStatus: results.succeeded,
    });
    return;
  }
  const code = readApiErrorCode(outcome.error);
  recordSaveFailure(evidence, code);
}

function recordSaveFailure(
  evidence: BrowserOperationEvidence,
  code: string | undefined,
): void {
  const mapping = getSaveFailureMapping(code);
  record({
    attributes: { [attributeNames.apiErrorCode]: code },
    evidence,
    name: mapping.name,
    resultStatus: mapping.resultStatus,
  });
}

function getSaveFailureMapping(code: string | undefined): {
  readonly name: string;
  readonly resultStatus: string;
} {
  if (code === apiErrorCodes.noteWriteConflict) {
    return {
      name: eventNames.noteSaveConflicted,
      resultStatus: results.conflicted,
    };
  }
  return { name: eventNames.noteSaveFailed, resultStatus: results.failed };
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
export function runBrowserOperation<Result>(input: {
  readonly callback: () => Result;
  readonly eventName: string;
  readonly evidence: BrowserOperationEvidence;
  readonly spanName: RuntimeSpanName;
  readonly startAttributes: RuntimeObservabilityAttributes;
}): Result {
  const attributes = baseAttributes(input.evidence, {
    ...input.startAttributes,
    [attributeNames.resultStatus]: results.started,
  });
  recordWebRuntimeEvent(
    createEvent(input.evidence, input.eventName, attributes),
  );
  return runWebRuntimeSpan(
    {
      attributes,
      name: input.eventName,
      spanName: input.spanName,
      spanOperation: runtimeSpanOperations.noteOperation,
      surface: "web",
    },
    input.callback,
  );
}

/** Canonical success marker for stale completion call sites. */
export const staleSucceeded = staleCompletionStatuses.succeeded;
/** Canonical failure marker for stale completion call sites. */
export const staleFailed = staleCompletionStatuses.failed;

function record(input: {
  readonly attributes: RuntimeObservabilityAttributes;
  readonly evidence: BrowserOperationEvidence;
  readonly name: string;
  readonly resultStatus: string;
}): void {
  recordWebRuntimeEvent(
    createEvent(
      input.evidence,
      input.name,
      baseAttributes(input.evidence, {
        ...input.attributes,
        [attributeNames.durationMs]: Math.max(
          0,
          performance.now() - input.evidence.startedAt,
        ),
        [attributeNames.resultStatus]: input.resultStatus,
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
  const event = {
    attributes,
    name,
    surface: "web",
  } as const;
  return withEventTags(
    event,
    compactTags({
      [attributeNames.apiErrorCode]:
        typeof apiCode === "string" ? apiCode : undefined,
      [attributeNames.noteOperationId]: evidence.metadata.noteOperationId,
      [attributeNames.requestId]: evidence.metadata.requestId,
      [attributeNames.resultStatus]:
        typeof result === "string" ? result : undefined,
    }),
  );
}

function withEventTags(
  event: Omit<RuntimeObservabilityEvent, "tags">,
  tags: RuntimeObservabilityEvent["tags"],
): RuntimeObservabilityEvent {
  return tags === undefined ? event : { ...event, tags };
}

function compactTags(
  tags: Readonly<Record<string, string | undefined>>,
): RuntimeObservabilityEvent["tags"] {
  return Object.fromEntries(
    Object.entries(tags).filter(([, value]) => value !== undefined),
  );
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
