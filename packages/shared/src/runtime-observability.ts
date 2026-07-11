/** Runtime surfaces that can emit Azurite observability events. */
export type RuntimeObservabilitySurface = "server" | "web";

/** Scalar values accepted by the shared runtime event extension surface. */
export type RuntimeObservabilityPrimitive =
  boolean | null | number | string | undefined;

/** Controlled serializable attributes accepted by runtime helper APIs. */
export type RuntimeObservabilityAttributes = Readonly<
  Record<string, RuntimeObservabilityPrimitive>
>;

/** Bounded lifecycle-neutral span names used by Slice 7B workflows. */
export type RuntimeSpanName =
  "api.request" | "note.load" | "note.read" | "note.save" | "notes.list";

/** Bounded span operations emitted by Azurite runtime adapters. */
export type RuntimeSpanOperation =
  | "azurite.api.request"
  | "azurite.note.operation"
  | "azurite.runtime"
  | "azurite.server.route";

/** Searchable event-local tag names allowed through runtime adapters. */
export type RuntimeSearchTagName =
  | "azurite.api_error_code"
  | "azurite.note_operation_id"
  | "azurite.request_id"
  | "azurite.result_status"
  | "http.route";

/** Event-local searchable tags accepted by the runtime adapters. */
export type RuntimeSearchTags = Readonly<
  Partial<Record<RuntimeSearchTagName, string>>
>;

/** Normalized caught-error detail attached to one captured event. */
export type RuntimeCaughtErrorContext = {
  readonly code?: string;
  readonly message: string;
  readonly name: string;
  readonly stack?: string;
};

/** Sentry-free event shape shared by web, server, and future feature slices. */
export type RuntimeObservabilityEvent = {
  readonly attributes?: RuntimeObservabilityAttributes;
  readonly name: string;
  readonly spanName?: RuntimeSpanName;
  readonly spanOperation?: RuntimeSpanOperation;
  readonly surface: RuntimeObservabilitySurface;
  readonly tags?: RuntimeSearchTags;
};

/** Stable Slice 7A and Slice 7B runtime event names. */
export const runtimeObservabilityEventNames = {
  apiRequestFailed: "api.request.failed",
  apiRequestStarted: "api.request.started",
  apiRequestSucceeded: "api.request.succeeded",
  consoleCaptured: "telemetry.runtime.console.captured",
  correlationIdGenerationFailed: "correlation.id_generation.failed",
  noteLoadFailed: "note.load.failed",
  noteLoadStaleIgnored: "note.load.stale_ignored",
  noteLoadStarted: "note.load.started",
  noteLoadSucceeded: "note.load.succeeded",
  noteReadFailed: "note.read.failed",
  noteReadInvalid: "note.read.invalid",
  noteReadNotFound: "note.read.not_found",
  noteReadStarted: "note.read.started",
  noteReadSucceeded: "note.read.succeeded",
  noteRouteNavigationRequested: "note.route.navigation_requested",
  noteRouteSynchronized: "note.route.synchronized",
  noteSaveConflicted: "note.save.conflicted",
  noteSaveFailed: "note.save.failed",
  noteSaveInvalid: "note.save.invalid",
  noteSaveNotFound: "note.save.not_found",
  noteSaveStarted: "note.save.started",
  noteSaveSucceeded: "note.save.succeeded",
  notesListFailed: "notes.list.failed",
  notesListStaleIgnored: "notes.list.stale_ignored",
  notesListStarted: "notes.list.started",
  notesListSucceeded: "notes.list.succeeded",
  serverTestTriggered: "telemetry.server.test.triggered",
  shutdownFailed: "telemetry.runtime.shutdown.failed",
  shutdownFlushed: "telemetry.runtime.shutdown.flushed",
  shutdownStarted: "telemetry.runtime.shutdown.started",
  traceHeadersSeen: "telemetry.runtime.trace_headers.seen",
  webTestTriggered: "telemetry.web.test.triggered",
} as const;

/** Stable attribute names reused by runtime helpers and future slices. */
export const runtimeObservabilityAttributeNames = {
  apiErrorCode: "azurite.api_error_code",
  baggageSeen: "sentry.baggage_seen",
  clusterId: "azurite.cluster_id",
  clusterIdentityReason: "azurite.cluster_identity_reason",
  clusterIdentityStatus: "azurite.cluster_identity_status",
  consoleLevel: "console.level",
  contentHash: "azurite.content_hash",
  correlationFailureReason: "azurite.correlation_failure_reason",
  correlationIdKind: "azurite.correlation_id_kind",
  durationMs: "azurite.duration_ms",
  environment: "sentry.environment",
  expectedContentHash: "azurite.expected_content_hash",
  flushResult: "azurite.flush_result",
  httpMethod: "http.method",
  httpResponseStatusCode: "http.response.status_code",
  httpRoute: "http.route",
  markdownLength: "azurite.markdown_length",
  messageSummary: "azurite.message_summary",
  noteCount: "azurite.note_count",
  noteId: "azurite.note_id",
  noteOperationId: "azurite.note_operation_id",
  noteOperationIdStatus: "azurite.note_operation_id_status",
  release: "sentry.release",
  requestId: "azurite.request_id",
  requestIdSource: "azurite.request_id_source",
  resultStatus: "azurite.result_status",
  routeSource: "azurite.route_source",
  sentryTraceSeen: "sentry.trace_header_seen",
  signal: "azurite.signal",
  staleCompletion: "azurite.stale_completion",
  surface: "app.surface",
  testEvent: "azurite.test_event",
  testMarker: "azurite.test_marker",
  uiRequestSequence: "azurite.ui_request_sequence",
} as const;

/** Exact lifecycle result values used by Slice 7B events. */
export const runtimeResultStatuses = {
  conflicted: "conflicted",
  failed: "failed",
  invalid: "invalid",
  notFound: "not_found",
  staleIgnored: "stale_ignored",
  started: "started",
  succeeded: "succeeded",
} as const;

/** Exact browser route-source values that current code can know truthfully. */
export const noteRouteSources = {
  draftDiscardReload: "draft_discard_reload",
  noteList: "note_list",
  startupFallback: "startup_fallback",
  urlSync: "url_sync",
} as const;

/** Whether an ignored stale completion returned data or an error. */
export const staleCompletionStatuses = {
  failed: "failed",
  succeeded: "succeeded",
} as const;

/** Exact lifecycle-neutral span names. */
export const runtimeSpanNames = {
  apiRequest: "api.request",
  noteLoad: "note.load",
  noteRead: "note.read",
  noteSave: "note.save",
  notesList: "notes.list",
} as const satisfies Record<string, RuntimeSpanName>;

/** Exact span operations emitted by runtime adapters. */
export const runtimeSpanOperations = {
  apiRequest: "azurite.api.request",
  noteOperation: "azurite.note.operation",
  runtime: "azurite.runtime",
  serverRoute: "azurite.server.route",
} as const satisfies Record<string, RuntimeSpanOperation>;

type RuntimeSpanOutcome<Result> =
  | { readonly status: "pending" | "running" }
  | { readonly error: unknown; readonly status: "threw" }
  | { readonly status: "returned"; readonly value: Result };
type SettledRuntimeSpanOutcome<Result> = Exclude<
  RuntimeSpanOutcome<Result>,
  { readonly status: "pending" | "running" }
>;

/**
 * Runs product work exactly once even when an optional span carrier fails.
 *
 * The starter's own return value is intentionally ignored so promise-returning
 * product work preserves the exact callback promise rather than an SDK wrapper.
 */
export function runFailOpenRuntimeSpan<Result>(
  startSpan: (callback: () => Result) => unknown,
  callback: () => Result,
): Result {
  const execution = new RuntimeSpanExecution(callback);

  try {
    startSpan(execution.run);
  } catch {
    // Product outcomes are selected below; SDK failures never replace them.
  }
  return execution.result();
}

class RuntimeSpanExecution<Result> {
  readonly #callback: () => Result;
  #outcome: RuntimeSpanOutcome<Result> = { status: "pending" };

  constructor(callback: () => Result) {
    this.#callback = callback;
  }

  readonly run = (): Result => {
    const settled = this.#readSettledOutcome();
    if (settled !== undefined) {
      return this.#replay(settled);
    }
    if (this.#outcome.status === "running") {
      throw new Error("Runtime span invoked product work reentrantly.");
    }
    return this.#execute();
  };

  result(): Result {
    const settled = this.#readSettledOutcome();
    return settled === undefined ? this.run() : this.#replay(settled);
  }

  #execute(): Result {
    this.#outcome = { status: "running" };
    try {
      const value = this.#callback();
      this.#outcome = { status: "returned", value };
      return value;
    } catch (error) {
      this.#outcome = { error, status: "threw" };
      throw error;
    }
  }

  #readSettledOutcome(): SettledRuntimeSpanOutcome<Result> | undefined {
    if (this.#outcome.status === "returned") {
      return this.#outcome;
    }
    if (this.#outcome.status === "threw") {
      return this.#outcome;
    }
    return undefined;
  }

  #replay(outcome: SettledRuntimeSpanOutcome<Result>): Result {
    if (outcome.status === "returned") {
      return outcome.value;
    }
    throw outcome.error;
  }
}

/** Marker shown in Replay and attached to deliberate Slice 7A test events. */
export const sentryTestEventMarker = "AZURITE-SENTRY-7A-UNMASKED-REPLAY-MARKER";
