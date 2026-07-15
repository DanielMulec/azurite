import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => {
  const scope = { setContext: vi.fn(), setTag: vi.fn() };

  return {
    addBreadcrumb: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({ name: "BrowserTracing" })),
    captureException: vi.fn(() => "event-id"),
    consoleLoggingIntegration: vi.fn(() => ({ name: "ConsoleLogs" })),
    init: vi.fn(),
    logger: { error: vi.fn(), info: vi.fn() },
    replayIntegration: vi.fn(() => ({ name: "Replay" })),
    scope,
    setContext: vi.fn(),
    setTag: vi.fn(),
    startSpan: vi.fn((_options: unknown, callback: () => unknown) =>
      callback(),
    ),
    withScope: vi.fn((callback: (value: typeof scope) => void) => {
      callback(scope);
    }),
  };
});

vi.mock("@sentry/react", () => sentry);

import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import {
  captureWebRuntimeError,
  recordWebRuntimeEvent,
  resetWebSentryRuntimeForTests,
  runWebRuntimeSpan,
} from "../src/observability/web-runtime-observability.js";
import { initializeWebSentryRuntime } from "../src/observability/web-sentry-runtime.js";

describe("web Sentry runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWebSentryRuntimeForTests();
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

    const event = { name: "carrier.installed", surface: "web" } as const;
    const error = new Error("installed capture");
    recordWebRuntimeEvent(event);
    captureWebRuntimeError(error, event);
    expect(runWebRuntimeSpan(event, () => "installed span")).toBe(
      "installed span",
    );
    expect(sentry.logger.info).toHaveBeenCalledOnce();
    expect(sentry.addBreadcrumb).toHaveBeenCalledOnce();
    expect(sentry.logger.error).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledWith(error);
    expect(sentry.startSpan).toHaveBeenCalledOnce();
  });
});
