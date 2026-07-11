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
      spanName: "note.load",
      spanOperation: "azurite.note.operation",
      surface: "web",
      tags: { "azurite.request_id": "future-7b" },
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
    expect(fake.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "note.load",
        op: "azurite.note.operation",
      }),
    );
    expect(fake.scope.setTag).toHaveBeenCalledWith(
      "azurite.request_id",
      "future-7b",
    );

    const error = new Error("deliberate");
    captureWebRuntimeError(error, event);
    expect(fake.captureException).toHaveBeenCalledWith(error);
    expect(fake.error).toHaveBeenCalled();
    expect(fake.scope.setContext).toHaveBeenCalledWith(
      "azurite.error",
      expect.objectContaining({ message: "deliberate", name: "Error" }),
    );
  });

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
    installWebSentryRuntime(
      fake.sdk,
      parseWebSentryConfig({
        VITE_SENTRY_DSN: "https://public@example.invalid/1",
        VITE_SENTRY_ENABLED: "true",
      }),
    );
    const event = { name: "carrier.failure", surface: "web" } as const;

    expect(() => {
      recordWebRuntimeEvent(event);
    }).not.toThrow();
    expect(() => {
      captureWebRuntimeError(new Error("product"), event);
    }).not.toThrow();
  });

  it("executes span work once across enabled SDK failures", () => {
    const fake = createFakeSdk();
    const callback = vi.fn(() => "product-result");
    fake.sdk.startSpan = (_options, guarded) => {
      guarded();
      throw new Error("span failed after callback");
    };
    installWebSentryRuntime(
      fake.sdk,
      parseWebSentryConfig({
        VITE_SENTRY_DSN: "https://public@example.invalid/1",
        VITE_SENTRY_ENABLED: "true",
      }),
    );

    expect(
      runWebRuntimeSpan({ name: "product.span", surface: "web" }, callback),
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
    scope,
    sdk,
    startSpan,
  };
}
