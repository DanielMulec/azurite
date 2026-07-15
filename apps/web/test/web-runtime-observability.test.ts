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

describe("web runtime observability facade", () => {
  it("keeps direct record, capture, and span calls safe when disabled", () => {
    const event = { name: "carrier.disabled", surface: "web" } as const;
    const callback = vi.fn(() => "completed");

    expect(() => {
      recordWebRuntimeEvent(event);
      captureWebRuntimeError(new Error("product"), event);
    }).not.toThrow();
    expect(runWebRuntimeSpan(event, callback)).toBe("completed");
    expect(callback).toHaveBeenCalledOnce();
  });

  it("forwards an installed SDK and current config to the shared carrier", () => {
    const fake = createFakeSdk();
    installWebSentryRuntime(
      fake.sdk,
      parseWebSentryConfig({
        VITE_SENTRY_DSN: "https://public@example.invalid/1",
        VITE_SENTRY_ENABLED: "true",
        VITE_SENTRY_ENVIRONMENT: "web-test",
        VITE_SENTRY_RELEASE: "azurite-web-test",
      }),
    );
    const event = { name: "carrier.enabled", surface: "web" } as const;
    const error = new Error("product");

    recordWebRuntimeEvent(event);
    captureWebRuntimeError(error, event);
    expect(runWebRuntimeSpan(event, () => 42)).toBe(42);

    expect(fake.info).toHaveBeenCalledOnce();
    expect(fake.info).toHaveBeenCalledWith(
      event.name,
      expect.objectContaining({
        "sentry.environment": "web-test",
        "sentry.release": "azurite-web-test",
      }),
      expect.any(Object),
    );
    expect(fake.addBreadcrumb).toHaveBeenCalledOnce();
    expect(fake.error).toHaveBeenCalledOnce();
    expect(fake.captureException).toHaveBeenCalledOnce();
    expect(fake.captureException).toHaveBeenCalledWith(error);
    expect(fake.startSpan).toHaveBeenCalledOnce();
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

  return {
    addBreadcrumb,
    captureException,
    error,
    info,
    sdk,
    startSpan,
  };
}
