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
});

describe("enabled server runtime observability", () => {
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
      spanName: "note.read",
      spanOperation: "azurite.server.route",
      surface: "server",
      tags: { "azurite.request_id": "future-7b" },
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
    expect(fake.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "note.read",
        op: "azurite.server.route",
      }),
    );
    expect(fake.scope.setTag).toHaveBeenCalledWith(
      "azurite.request_id",
      "future-7b",
    );

    const error = new Error("deliberate");
    captureServerRuntimeError(error, event);
    expect(fake.captureException).toHaveBeenCalledWith(error);
    expect(fake.error).toHaveBeenCalled();
    expect(fake.scope.setContext).toHaveBeenCalledWith(
      "azurite.error",
      expect.objectContaining({ message: "deliberate", name: "Error" }),
    );
  });
});

describe("server runtime observability failure isolation", () => {
  it("suppresses enabled SDK carrier failures", () => {
    const fake = createFakeSdk();
    fake.sdk.withScope = () => {
      throw new Error("scope failed");
    };
    fake.sdk.addBreadcrumb = () => {
      throw new Error("breadcrumb failed");
    };
    fake.sdk.logger.info = () => {
      throw new Error("log failed");
    };
    fake.sdk.logger.error = () => {
      throw new Error("error log failed");
    };
    fake.sdk.captureException = () => {
      throw new Error("capture failed");
    };
    installServerSentryRuntime(
      fake.sdk,
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
      }),
    );
    const event = { name: "carrier.failure", surface: "server" } as const;

    expect(() => {
      recordServerRuntimeEvent(event);
    }).not.toThrow();
    expect(() => {
      captureServerRuntimeError(new Error("product"), event);
    }).not.toThrow();
  });

  it("executes span work once across enabled SDK failures", () => {
    const fake = createFakeSdk();
    const callback = vi.fn(() => "product-result");
    fake.sdk.startSpan = (_options, guarded) => {
      guarded();
      throw new Error("span failed after callback");
    };
    installServerSentryRuntime(
      fake.sdk,
      parseServerSentryConfig({
        SENTRY_DSN: "https://public@example.invalid/1",
        SENTRY_ENABLED: "true",
      }),
    );

    expect(
      runServerRuntimeSpan(
        { name: "product.span", surface: "server" },
        callback,
      ),
    ).toBe("product-result");
    expect(callback).toHaveBeenCalledTimes(1);
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

  return {
    addBreadcrumb,
    captureException,
    error,
    info,
    scope,
    sdk,
    startSpan,
  };
}
