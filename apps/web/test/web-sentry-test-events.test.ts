// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  developmentRequestHeaders,
  developmentRequestHeaderValues,
  sentryTestEventMarker,
} from "@azurite/shared";

const runtime = vi.hoisted(() => ({
  captureWebRuntimeError: vi.fn(),
  recordWebRuntimeEvent: vi.fn(),
  runWebRuntimeSpan: vi.fn(
    <Result>(_event: unknown, callback: () => Result): Result => callback(),
  ),
}));

vi.mock("../src/observability/web-runtime-observability.js", () => runtime);

import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import {
  triggerServerSentryTestEvent,
  triggerWebSentryTestEvent,
} from "../src/observability/web-sentry-test-events.js";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("web Sentry test events", () => {
  it("uses structured helpers and emits explicit console warning evidence", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = createEnabledConfig();

    triggerWebSentryTestEvent(config);

    expect(runtime.recordWebRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "telemetry.web.test.triggered",
      }),
    );
    expect(runtime.captureWebRuntimeError).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(sentryTestEventMarker),
    );
  });

  it("uses the confirmation header and parses server trace evidence", async () => {
    const fetchMock = vi.fn<typeof fetch>((_input, request) => {
      expect(request).toMatchObject({
        headers: {
          [developmentRequestHeaders.sentryTestEventConfirmation]:
            developmentRequestHeaderValues.sentryTestEventConfirmation,
        },
        method: "POST",
      });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            marker: sentryTestEventMarker,
            status: "sent",
            traceHeaders: { baggage: true, sentryTrace: true },
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      triggerServerSentryTestEvent(createEnabledConfig()),
    ).resolves.toMatchObject({
      traceHeaders: { baggage: true, sentryTrace: true },
    });
  });
});

function createEnabledConfig() {
  return parseWebSentryConfig({
    VITE_SENTRY_DSN: "https://public@example.invalid/1",
    VITE_SENTRY_ENABLED: "true",
    VITE_SENTRY_TEST_EVENTS_ENABLED: "true",
  });
}
