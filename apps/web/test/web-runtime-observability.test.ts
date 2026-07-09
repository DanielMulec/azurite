import { afterEach, describe, expect, it, vi } from "vitest";

import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import {
  captureWebRuntimeError,
  installWebSentryRuntime,
  recordWebRuntimeEvent,
  resetWebSentryRuntimeForTests,
  runWebRuntimeSpan,
  type WebSentrySdk,
} from "../src/observability/web-runtime-observability.js";

afterEach(() => {
  resetWebSentryRuntimeForTests();
});

describe("web runtime observability helpers", () => {
  it("are no-op safe without an installed SDK", () => {
    expect(
      runWebRuntimeSpan(
        { name: "future.7b.event", surface: "web" },
        () => "completed",
      ),
    ).toBe("completed");
  });

  it("maps extensible events to structured carriers", () => {
    const fake = createFakeSdk();
    installWebSentryRuntime(
      fake.sdk,
      parseWebSentryConfig({
        VITE_SENTRY_DSN: "https://public@example.invalid/1",
        VITE_SENTRY_ENABLED: "true",
        VITE_SENTRY_ENVIRONMENT: "test",
        VITE_SENTRY_RELEASE: "azurite-test",
      }),
    );
    const event = {
      attributes: { "azurite.request_id": "future-7b" },
      name: "future.7b.event",
      surface: "web",
    } as const;

    recordWebRuntimeEvent(event);
    expect(fake.info).toHaveBeenCalledWith(
      "future.7b.event",
      expect.objectContaining({
        "app.surface": "web",
        "azurite.request_id": "future-7b",
      }),
      expect.any(Object),
    );
    expect(fake.addBreadcrumb).toHaveBeenCalled();
    expect(runWebRuntimeSpan(event, () => 42)).toBe(42);
    expect(fake.startSpan).toHaveBeenCalled();

    const error = new Error("deliberate");
    captureWebRuntimeError(error, event);
    expect(fake.captureException).toHaveBeenCalledWith(error);
    expect(fake.error).toHaveBeenCalled();
  });
});

function createFakeSdk() {
  const addBreadcrumb = vi.fn();
  const captureException = vi.fn(() => "event-id");
  const error = vi.fn();
  const info = vi.fn();
  const startSpan = vi.fn();
  const scope = { setContext: vi.fn(), setTag: vi.fn() };
  const sdk: WebSentrySdk = {
    addBreadcrumb,
    captureException,
    logger: { error, info },
    startSpan<Result>(options: unknown, callback: () => Result): Result {
      startSpan(options);
      return callback();
    },
    withScope(callback) {
      callback(scope);
    },
  };

  return { addBreadcrumb, captureException, error, info, sdk, startSpan };
}
