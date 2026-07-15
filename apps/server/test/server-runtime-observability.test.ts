import { afterEach, describe, expect, it, vi } from "vitest";

import { parseServerSentryConfig } from "../src/config/sentry-config.js";
import {
  captureServerRuntimeError,
  flushServerSentry,
  installServerSentryRuntime,
  isServerSentryRuntimeEnabled,
  recordServerRuntimeEvent,
  resetServerSentryRuntimeForTests,
  runServerRuntimeSpan,
  type ServerSentrySdk,
} from "../src/observability/server-runtime-observability.js";

afterEach(() => {
  resetServerSentryRuntimeForTests();
});

describe("server runtime observability facade", () => {
  it("keeps direct record, capture, span, enablement, and flush safe when disabled", async () => {
    const event = { name: "carrier.disabled", surface: "server" } as const;
    const callback = vi.fn(() => "completed");

    expect(() => {
      recordServerRuntimeEvent(event);
      captureServerRuntimeError(new Error("product"), event);
    }).not.toThrow();
    expect(runServerRuntimeSpan(event, callback)).toBe("completed");
    expect(callback).toHaveBeenCalledOnce();
    expect(isServerSentryRuntimeEnabled()).toBe(false);
    await expect(flushServerSentry(500)).resolves.toBe(true);
  });

  it("forwards an installed SDK and current config to the shared carrier", () => {
    const fake = createFakeSdk();
    installServerSentryRuntime(
      fake.sdk,
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
        SENTRY_ENVIRONMENT: "server-test",
        SENTRY_RELEASE: "azurite-server-test",
      }),
    );
    const event = { name: "carrier.enabled", surface: "server" } as const;
    const error = new Error("product");

    recordServerRuntimeEvent(event);
    captureServerRuntimeError(error, event);
    expect(runServerRuntimeSpan(event, () => 42)).toBe(42);

    expect(isServerSentryRuntimeEnabled()).toBe(true);
    expect(fake.info).toHaveBeenCalledOnce();
    expect(fake.info).toHaveBeenCalledWith(
      event.name,
      expect.objectContaining({
        "sentry.environment": "server-test",
        "sentry.release": "azurite-server-test",
      }),
      expect.any(Object),
    );
    expect(fake.addBreadcrumb).toHaveBeenCalledOnce();
    expect(fake.error).toHaveBeenCalledOnce();
    expect(fake.captureException).toHaveBeenCalledWith(error);
    expect(fake.startSpan).toHaveBeenCalledOnce();
  });

  it("delegates flush to the installed SDK with the exact budget", async () => {
    const fake = createFakeSdk();
    fake.flush.mockResolvedValueOnce(false);
    installServerSentryRuntime(
      fake.sdk,
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
      }),
    );

    await expect(flushServerSentry(731)).resolves.toBe(false);
    expect(fake.flush).toHaveBeenCalledOnce();
    expect(fake.flush).toHaveBeenCalledWith(731);
  });
});

function createFakeSdk() {
  const addBreadcrumb = vi.fn();
  const captureException = vi.fn(() => "event-id");
  const error = vi.fn();
  const flush = vi.fn(() => Promise.resolve(true));
  const info = vi.fn();
  const startSpan = vi.fn();
  const scope = { setContext: vi.fn(), setTag: vi.fn() };
  const sdk: ServerSentrySdk = {
    addBreadcrumb,
    captureException,
    flush,
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
    flush,
    info,
    sdk,
    startSpan,
  };
}
