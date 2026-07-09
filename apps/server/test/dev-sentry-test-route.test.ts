import { describe, expect, it } from "vitest";

import {
  apiRoutes,
  developmentRequestHeaders,
  developmentRequestHeaderValues,
  sentryTestEventMarker,
} from "@azurite/shared";
import { createServer } from "../src/app.js";
import { parseServerSentryConfig } from "../src/config/sentry-config.js";

describe("development Sentry test route", () => {
  it("is absent unless the non-production env gate is literal true", async () => {
    const server = createServer({}, parseServerSentryConfig({}));
    const response = await server.inject({
      method: "POST",
      url: apiRoutes.devSentryTestEvent,
    });

    expect(response.statusCode).toBe(404);
  });

  it("requires explicit confirmation and never runs through note routes", async () => {
    const server = createServer({}, createTestRouteConfig());
    const response = await server.inject({
      method: "POST",
      url: apiRoutes.devSentryTestEvent,
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns trace-header evidence for a confirmed non-mutating event", async () => {
    const server = createServer({}, createTestRouteConfig());
    const response = await server.inject({
      headers: {
        baggage: "sentry-release=azurite-test",
        [developmentRequestHeaders.sentryTestEventConfirmation]:
          developmentRequestHeaderValues.sentryTestEventConfirmation,
        "sentry-trace": "0123456789abcdef0123456789abcdef-0123456789abcdef-1",
      },
      method: "POST",
      url: apiRoutes.devSentryTestEvent,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      marker: sentryTestEventMarker,
      status: "sent",
      traceHeaders: { baggage: true, sentryTrace: true },
    });
  });
});

function createTestRouteConfig() {
  return parseServerSentryConfig({
    NODE_ENV: "development",
    SENTRY_TEST_EVENTS_ENABLED: "true",
  });
}
