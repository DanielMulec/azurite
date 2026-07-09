import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
} from "@azurite/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { ServerSentryConfig } from "../config/sentry-config.js";
import { recordServerRuntimeEvent } from "./server-runtime-observability.js";

type RuntimeEventRecorder = typeof recordServerRuntimeEvent;

/** Records whether sampled browser trace headers reach Fastify API requests. */
export function registerRuntimeTraceEvidence(
  server: FastifyInstance,
  config: ServerSentryConfig,
  recordEvent: RuntimeEventRecorder = recordServerRuntimeEvent,
): void {
  if (!config.enabled) {
    return;
  }

  server.addHook("onRequest", (request, _reply, done) => {
    const routePath = request.routeOptions.url;

    if (routePath?.startsWith("/api/") === true) {
      recordTraceHeaderEvidence(request, routePath, recordEvent);
    }

    done();
  });
}

function recordTraceHeaderEvidence(
  request: FastifyRequest,
  routePath: string,
  recordEvent: RuntimeEventRecorder,
): void {
  recordEvent({
    attributes: {
      [runtimeObservabilityAttributeNames.baggageSeen]: hasHeader(
        request.headers.baggage,
      ),
      [runtimeObservabilityAttributeNames.httpMethod]: request.method,
      [runtimeObservabilityAttributeNames.httpRoute]: routePath,
      [runtimeObservabilityAttributeNames.sentryTraceSeen]: hasHeader(
        request.headers["sentry-trace"],
      ),
    },
    name: runtimeObservabilityEventNames.traceHeadersSeen,
    surface: "server",
  });
}

function hasHeader(value: string | readonly string[] | undefined): boolean {
  return typeof value === "string" ? value.length > 0 : value !== undefined;
}
