import {
  apiRoutes,
  developmentRequestHeaders,
  developmentRequestHeaderValues,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  sentryTestEventMarker,
  sentryTestEventResponseSchema,
} from "@azurite/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { ServerSentryConfig } from "./config/sentry-config.js";
import {
  captureServerRuntimeError,
  recordServerRuntimeEvent,
  runServerRuntimeSpan,
} from "./observability/server-runtime-observability.js";

const confirmationError = {
  error: "Explicit Sentry test-event confirmation is required.",
} as const;

/** Registers the explicit, development-only, non-mutating Sentry test route. */
export function registerDevSentryTestRoute(
  server: FastifyInstance,
  config: ServerSentryConfig,
): void {
  if (!config.testEventsEnabled) {
    return;
  }

  server.post(apiRoutes.devSentryTestEvent, async (request, reply) => {
    if (!hasSentryConfirmation(request)) {
      return reply.status(403).send(confirmationError);
    }

    return runServerRuntimeSpan(createTestEvent(config, request), async () => {
      const event = createTestEvent(config, request);
      recordServerRuntimeEvent(event);
      captureServerRuntimeError(
        new Error("Azurite deliberate server Sentry test event."),
        event,
      );
      request.log.info(
        { marker: sentryTestEventMarker },
        "Emitted deliberate server Sentry test event.",
      );

      return reply.send(
        sentryTestEventResponseSchema.parse({
          marker: sentryTestEventMarker,
          status: "sent",
          traceHeaders: readTraceHeaderPresence(request),
        }),
      );
    });
  });
}

function hasSentryConfirmation(request: FastifyRequest): boolean {
  return (
    request.headers[developmentRequestHeaders.sentryTestEventConfirmation] ===
    developmentRequestHeaderValues.sentryTestEventConfirmation
  );
}

function createTestEvent(config: ServerSentryConfig, request: FastifyRequest) {
  const traceHeaders = readTraceHeaderPresence(request);

  return {
    attributes: {
      [runtimeObservabilityAttributeNames.baggageSeen]: traceHeaders.baggage,
      [runtimeObservabilityAttributeNames.environment]: config.environment,
      [runtimeObservabilityAttributeNames.httpMethod]: request.method,
      [runtimeObservabilityAttributeNames.httpRoute]:
        apiRoutes.devSentryTestEvent,
      [runtimeObservabilityAttributeNames.release]: config.release,
      [runtimeObservabilityAttributeNames.sentryTraceSeen]:
        traceHeaders.sentryTrace,
      [runtimeObservabilityAttributeNames.testEvent]: true,
      [runtimeObservabilityAttributeNames.testMarker]: sentryTestEventMarker,
    },
    name: runtimeObservabilityEventNames.serverTestTriggered,
    surface: "server",
  } as const;
}

function readTraceHeaderPresence(request: FastifyRequest): {
  readonly baggage: boolean;
  readonly sentryTrace: boolean;
} {
  return {
    baggage: hasHeader(request.headers.baggage),
    sentryTrace: hasHeader(request.headers["sentry-trace"]),
  };
}

function hasHeader(value: string | readonly string[] | undefined): boolean {
  return typeof value === "string" ? value.length > 0 : value !== undefined;
}
