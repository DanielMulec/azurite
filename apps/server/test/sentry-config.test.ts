import { describe, expect, it } from "vitest";

import { parseServerSentryConfig } from "../src/config/sentry-config.js";

describe("server Sentry config", () => {
  it("stays disabled unless literal true and a DSN are both present", () => {
    expect(parseServerSentryConfig({}).enabled).toBe(false);
    expect(
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "1",
      }).enabled,
    ).toBe(false);
    expect(parseServerSentryConfig({ SENTRY_ENABLED: "true" }).enabled).toBe(
      false,
    );
    expect(
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
      }).enabled,
    ).toBe(true);
  });

  it("gates test events out of production and falls back for invalid rates", () => {
    expect(
      parseServerSentryConfig({
        NODE_ENV: "development",
        SENTRY_TEST_EVENTS_ENABLED: "true",
        SENTRY_TRACE_SAMPLE_RATE: "invalid",
      }),
    ).toMatchObject({ testEventsEnabled: true, traceSampleRate: 1 });
    expect(
      parseServerSentryConfig({
        NODE_ENV: "production",
        SENTRY_TEST_EVENTS_ENABLED: "true",
      }).testEventsEnabled,
    ).toBe(false);
  });
});
