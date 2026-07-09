import { afterEach, describe, expect, it, vi } from "vitest";

import { parseServerSentryConfig } from "../src/config/sentry-config.js";
import {
  captureServerRuntimeError,
  installServerSentryRuntime,
  recordServerRuntimeEvent,
  resetServerSentryRuntimeForTests,
  runServerRuntimeSpan,
  type ServerSentrySdk,
} from "../src/observability/server-runtime-observability.js";

afterEach(() => {
  resetServerSentryRuntimeForTests();
});

describe("server runtime observability helpers", () => {
  it("are no-op safe without an installed SDK", () => {
    expect(
      runServerRuntimeSpan(
        { name: "future.7b.event", surface: "server" },
        () => "completed",
      ),
    ).toBe("completed");
    expect(() => {
      recordServerRuntimeEvent({ name: "future.7b.event", surface: "server" });
    }).not.toThrow();
  });

  it("maps extensible events to logs, breadcrumbs, spans, and errors", () => {
    const fake = createFakeSdk();
    installServerSentryRuntime(
      fake.sdk,
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
        SENTRY_ENVIRONMENT: "test",
        SENTRY_RELEASE: "azurite-test",
      }),
    );
    const event = {
      attributes: { "azurite.request_id": "future-7b" },
      name: "future.7b.event",
      surface: "server",
    } as const;

    recordServerRuntimeEvent(event);
    expect(fake.info).toHaveBeenCalledWith(
      "future.7b.event",
      expect.objectContaining({
        "app.surface": "server",
        "azurite.request_id": "future-7b",
        "sentry.environment": "test",
        "sentry.release": "azurite-test",
      }),
      expect.any(Object),
    );
    expect(fake.addBreadcrumb).toHaveBeenCalled();
    expect(runServerRuntimeSpan(event, () => 42)).toBe(42);
    expect(fake.startSpan).toHaveBeenCalled();

    const error = new Error("deliberate");
    captureServerRuntimeError(error, event);
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
  const sdk: ServerSentrySdk = {
    addBreadcrumb,
    captureException,
    flush: vi.fn(() => Promise.resolve(true)),
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
