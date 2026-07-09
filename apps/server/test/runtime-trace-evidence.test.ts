import { describe, expect, it, vi } from "vitest";

import type { RuntimeObservabilityEvent } from "@azurite/shared";
import Fastify from "fastify";
import { parseServerSentryConfig } from "../src/config/sentry-config.js";
import { registerRuntimeTraceEvidence } from "../src/observability/runtime-trace-evidence.js";

describe("Fastify runtime trace evidence", () => {
  it("records Sentry trace and baggage headers at the API boundary", async () => {
    const server = Fastify();
    const recordEvent = vi.fn<(event: RuntimeObservabilityEvent) => void>();
    registerRuntimeTraceEvidence(
      server,
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
      }),
      recordEvent,
    );
    server.get("/api/probe", () => ({ ok: true }));

    await server.inject({
      headers: {
        baggage: "sentry-release=azurite-test",
        "sentry-trace": "0123456789abcdef0123456789abcdef-0123456789abcdef-1",
      },
      method: "GET",
      url: "/api/probe",
    });

    expect(recordEvent).toHaveBeenCalledOnce();
    const recordedEvent = readRecordedEvent(recordEvent.mock.calls);
    expect(recordedEvent.name).toBe("telemetry.runtime.trace_headers.seen");
    expect(recordedEvent.attributes).toMatchObject({
      "sentry.baggage_seen": true,
      "sentry.trace_header_seen": true,
    });
  });
});

function readRecordedEvent(
  calls: readonly (readonly [RuntimeObservabilityEvent])[],
): RuntimeObservabilityEvent {
  const firstCall = calls[0];

  if (firstCall === undefined) {
    throw new Error("Expected one recorded runtime event.");
  }

  return firstCall[0];
}
