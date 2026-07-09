import { describe, expect, it, vi } from "vitest";

import { createServer } from "../src/app.js";
import {
  closeServerAfterSignal,
  createShutdownSignalHandler,
  disabledShutdownFallbackMs,
  enabledShutdownFallbackMs,
  sentryShutdownFlushTimeoutMs,
  type ShutdownObservability,
} from "../src/server-lifecycle.js";

describe("closeServerAfterSignal", () => {
  it("preserves disabled shutdown without Sentry work", async () => {
    const server = createServer({});
    await server.listen({ host: "127.0.0.1", port: 0 });
    const observability = createObservability(false);

    const exitCode = await closeServerAfterSignal(
      server,
      "SIGINT",
      observability,
    );

    expect(exitCode).toBe(0);
    expect(server.server.listening).toBe(false);
    expect(observability.flush).not.toHaveBeenCalled();
    expect(observability.recordEvent).not.toHaveBeenCalled();
  });

  it("closes Fastify before a 1000ms enabled Sentry flush", async () => {
    const server = createServer({});
    const order: string[] = [];
    server.addHook("onClose", (_instance, done) => {
      order.push("fastify.close");
      done();
    });
    await server.listen({ host: "127.0.0.1", port: 0 });
    const observability = createObservability(true, (timeoutMs) => {
      order.push(`sentry.flush:${String(timeoutMs)}`);
      return Promise.resolve(true);
    });

    const exitCode = await closeServerAfterSignal(
      server,
      "SIGTERM",
      observability,
    );

    expect(exitCode).toBe(0);
    expect(order).toEqual([
      "fastify.close",
      `sentry.flush:${String(sentryShutdownFlushTimeoutMs)}`,
    ]);
    expect(observability.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "telemetry.runtime.shutdown.flushed",
      }),
    );
  });
});

describe("closeServerAfterSignal failures", () => {
  it("captures an enabled flush timeout as a shutdown failure", async () => {
    const server = createServer({});
    await server.listen({ host: "127.0.0.1", port: 0 });
    const observability = createObservability(true, () =>
      Promise.resolve(false),
    );

    const exitCode = await closeServerAfterSignal(
      server,
      "SIGTERM",
      observability,
    );

    expect(exitCode).toBe(1);
    expectFlushTimeoutEvidence(observability);
  });
});

describe("createShutdownSignalHandler", () => {
  it("uses the unchanged 500ms disabled fallback", async () => {
    const server = createServer({});
    await server.listen({ host: "127.0.0.1", port: 0 });
    const scheduledDelays: number[] = [];
    const exitProcess = vi.fn();
    const timeout = setTimeout(() => {}, 60_000);
    const handler = createShutdownSignalHandler(server, {
      clearFallback: clearTimeout,
      exitProcess,
      observability: createObservability(false),
      scheduleFallback(_callback, delayMs) {
        scheduledDelays.push(delayMs);
        return timeout;
      },
    });

    handler("SIGINT");
    await vi.waitFor(() => {
      expect(exitProcess).toHaveBeenCalledWith(0);
    });
    expect(scheduledDelays).toEqual([disabledShutdownFallbackMs]);
  });

  it("lets the 1500ms fallback win over a hung enabled flush", async () => {
    const server = createServer({});
    await server.listen({ host: "127.0.0.1", port: 0 });
    const pendingFlush = createDeferredFlush();
    const exitProcess = vi.fn();
    let fallbackCallback: (() => void) | undefined;
    const timeout = setTimeout(() => {}, 60_000);
    const handler = createShutdownSignalHandler(server, {
      clearFallback: clearTimeout,
      exitProcess,
      observability: createObservability(true, () => pendingFlush.promise),
      scheduleFallback(callback, delayMs) {
        expect(delayMs).toBe(enabledShutdownFallbackMs);
        fallbackCallback = callback;
        return timeout;
      },
    });

    handler("SIGTERM");
    await vi.waitFor(() => {
      expect(fallbackCallback).toBeTypeOf("function");
    });
    fallbackCallback?.();
    expect(exitProcess).toHaveBeenCalledWith(0);

    pendingFlush.resolve(true);
    await vi.waitFor(() => {
      expect(exitProcess).toHaveBeenCalledTimes(2);
    });
  });
});

function createObservability(
  enabled: boolean,
  flushImplementation: (timeoutMs: number) => Promise<boolean> = () =>
    Promise.resolve(true),
): ShutdownObservability {
  return {
    captureError: vi.fn<ShutdownObservability["captureError"]>(),
    enabled,
    flush: vi.fn<ShutdownObservability["flush"]>(flushImplementation),
    recordEvent: vi.fn<ShutdownObservability["recordEvent"]>(),
  };
}

function createDeferredFlush(): {
  readonly promise: Promise<boolean>;
  readonly resolve: (result: boolean) => void;
} {
  let resolvePromise: (result: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

function expectFlushTimeoutEvidence(
  observability: ShutdownObservability,
): void {
  const flushedEvent = vi
    .mocked(observability.recordEvent)
    .mock.calls.map(([event]) => event)
    .find((event) => event.name === "telemetry.runtime.shutdown.flushed");

  if (flushedEvent === undefined) {
    throw new Error("Expected a shutdown flush result event.");
  }

  const capturedFailure = vi.mocked(observability.captureError).mock.calls[0];

  if (capturedFailure === undefined) {
    throw new Error("Expected a captured shutdown failure.");
  }

  expect(flushedEvent.attributes).toMatchObject({
    "azurite.flush_result": false,
  });
  expect(capturedFailure[0]).toBeInstanceOf(Error);
  expect(capturedFailure[1].name).toBe("telemetry.runtime.shutdown.failed");
}
