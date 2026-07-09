import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  browserTracingIntegration: vi.fn(() => ({ name: "BrowserTracing" })),
  consoleLoggingIntegration: vi.fn(() => ({ name: "ConsoleLogs" })),
  init: vi.fn(),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
  setContext: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("@sentry/react", () => sentry);

import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import { initializeWebSentryRuntime } from "../src/observability/web-sentry-runtime.js";

describe("web Sentry runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures Replay, logs, console capture, and tracing", () => {
    const config = parseWebSentryConfig({
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      VITE_SENTRY_ENABLED: "true",
      VITE_SENTRY_ENVIRONMENT: "local-debug",
      VITE_SENTRY_RELEASE: "azurite-test",
    });

    initializeWebSentryRuntime(config);

    expect(sentry.replayIntegration).toHaveBeenCalledWith({
      blockAllMedia: false,
      maskAllInputs: false,
      maskAllText: false,
    });
    expect(sentry.consoleLoggingIntegration).toHaveBeenCalledWith({
      levels: ["warn", "error"],
    });
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: config.dsn,
        enableLogs: true,
        environment: "local-debug",
        release: "azurite-test",
        replaysOnErrorSampleRate: 1,
        replaysSessionSampleRate: 1,
        tracesSampleRate: 1,
      }),
    );
  });
});
