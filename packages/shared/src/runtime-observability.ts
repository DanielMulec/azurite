/** Runtime surfaces that can emit Azurite observability events. */
export type RuntimeObservabilitySurface = "server" | "web";

/** Scalar values accepted by the shared runtime event extension surface. */
export type RuntimeObservabilityPrimitive =
  boolean | null | number | string | undefined;

/** Controlled serializable attributes accepted by runtime helper APIs. */
export type RuntimeObservabilityAttributes = Readonly<
  Record<string, RuntimeObservabilityPrimitive>
>;

/** Sentry-free event shape shared by web, server, and future feature slices. */
export type RuntimeObservabilityEvent = {
  readonly attributes?: RuntimeObservabilityAttributes;
  readonly name: string;
  readonly surface: RuntimeObservabilitySurface;
};

/** Stable Slice 7A runtime event names. */
export const runtimeObservabilityEventNames = {
  consoleCaptured: "telemetry.runtime.console.captured",
  serverTestTriggered: "telemetry.server.test.triggered",
  shutdownFailed: "telemetry.runtime.shutdown.failed",
  shutdownFlushed: "telemetry.runtime.shutdown.flushed",
  shutdownStarted: "telemetry.runtime.shutdown.started",
  traceHeadersSeen: "telemetry.runtime.trace_headers.seen",
  webTestTriggered: "telemetry.web.test.triggered",
} as const;

/** Stable attribute names reused by runtime helpers and future slices. */
export const runtimeObservabilityAttributeNames = {
  baggageSeen: "sentry.baggage_seen",
  consoleLevel: "console.level",
  durationMs: "azurite.duration_ms",
  environment: "sentry.environment",
  flushResult: "azurite.flush_result",
  httpMethod: "http.method",
  httpRoute: "http.route",
  messageSummary: "azurite.message_summary",
  release: "sentry.release",
  resultStatus: "azurite.result_status",
  sentryTraceSeen: "sentry.trace_header_seen",
  signal: "azurite.signal",
  surface: "app.surface",
  testEvent: "azurite.test_event",
  testMarker: "azurite.test_marker",
} as const;

/** Marker shown in Replay and attached to deliberate Slice 7A test events. */
export const sentryTestEventMarker = "AZURITE-SENTRY-7A-UNMASKED-REPLAY-MARKER";
