import { describe, expect, it } from "vitest";

import {
  parseWebSentryConfig,
  uncensoredReplayOptions,
  webTracePropagationTargets,
} from "../src/config/sentry-config.js";

describe("web Sentry config", () => {
  it("stays disabled unless literal true and a DSN are both present", () => {
    expect(parseWebSentryConfig({}).enabled).toBe(false);
    expect(
      parseWebSentryConfig({
        VITE_SENTRY_DSN: "https://public@example.invalid/1",
        VITE_SENTRY_ENABLED: "TRUE",
      }).enabled,
    ).toBe(false);
    expect(parseWebSentryConfig({ VITE_SENTRY_ENABLED: "true" }).enabled).toBe(
      false,
    );
    expect(
      parseWebSentryConfig({
        VITE_SENTRY_DSN: "https://public@example.invalid/1",
        VITE_SENTRY_ENABLED: "true",
      }).enabled,
    ).toBe(true);
  });

  it("parses literal test gating and safe sample-rate fallbacks", () => {
    const config = parseWebSentryConfig({
      VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE: "0",
      VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE: "1",
      VITE_SENTRY_TEST_EVENTS_ENABLED: "true",
      VITE_SENTRY_TRACE_SAMPLE_RATE: "1.2",
    });

    expect(config).toMatchObject({
      replayErrorSampleRate: 0,
      replaySessionSampleRate: 1,
      testEventsEnabled: true,
      traceSampleRate: 1,
    });
  });

  it("uses uncensored Replay options and includes same-origin API targets", () => {
    expect(uncensoredReplayOptions).toEqual({
      blockAllMedia: false,
      maskAllInputs: false,
      maskAllText: false,
    });
    expect(
      webTracePropagationTargets.some(
        (target) => target instanceof RegExp && target.test("/api/notes"),
      ),
    ).toBe(true);
  });
});
