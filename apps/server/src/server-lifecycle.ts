import type { FastifyInstance } from "fastify";

import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  type RuntimeObservabilityEvent,
} from "@azurite/shared";

import {
  captureServerRuntimeError,
  flushServerSentry,
  isServerSentryRuntimeEnabled,
  recordServerRuntimeEvent,
} from "./observability/server-runtime-observability.js";

type ShutdownExitCode = 0 | 1;

/** Existing process fallback retained when Sentry is disabled. */
export const disabledShutdownFallbackMs = 500;
/** Process fallback that remains longer than the enabled Sentry flush budget. */
export const enabledShutdownFallbackMs = 1_500;
/** Maximum SDK flush budget after Fastify has closed. */
export const sentryShutdownFlushTimeoutMs = 1_000;
/** Follow-up budget that delivers the result recorded after the initial flush. */
export const sentryShutdownResultFlushTimeoutMs = 400;

/** Observable shutdown operations supplied by the enabled preload runtime. */
export type ShutdownObservability = {
  readonly captureError: (
    error: unknown,
    event: RuntimeObservabilityEvent,
  ) => void;
  readonly enabled: boolean;
  readonly flush: (timeoutMs: number) => Promise<boolean>;
  readonly recordEvent: (event: RuntimeObservabilityEvent) => void;
};

type ExitProcess = (exitCode: ShutdownExitCode) => void;

type ScheduleFallback = (
  callback: () => void,
  delayMs: number,
) => NodeJS.Timeout;

type ShutdownEventContext = {
  readonly observability: ShutdownObservability;
  readonly signal: NodeJS.Signals;
  readonly startedAt: number;
};

/** Process/timer boundaries used by the server signal handler. */
export type ShutdownHandlerDependencies = {
  readonly clearFallback: (timeout: NodeJS.Timeout) => void;
  readonly exitProcess: ExitProcess;
  readonly observability: ShutdownObservability;
  readonly scheduleFallback: ScheduleFallback;
};

/** Closes the Fastify server after an operating-system shutdown signal. */
export async function closeServerAfterSignal(
  server: FastifyInstance,
  signal: NodeJS.Signals,
  observability: ShutdownObservability = createShutdownObservability(),
): Promise<ShutdownExitCode> {
  server.log.info({ signal }, "Shutting down local server.");
  const context = {
    observability,
    signal,
    startedAt: performance.now(),
  } satisfies ShutdownEventContext;
  recordShutdownStarted(context);

  try {
    await server.close();
    const flushSucceeded = await flushAfterFastifyClose(context);
    return completeClosedServer(server, signal, flushSucceeded);
  } catch (error) {
    recordShutdownFailure(error, context);
    server.log.error({ error, signal }, "Failed to shut down local server.");
    return 1;
  }
}

/** Registers graceful shutdown handlers for local development and process managers. */
export function registerGracefulShutdown(server: FastifyInstance): void {
  const handleShutdownSignal = createShutdownSignalHandler(server);

  process.on("SIGINT", handleShutdownSignal);
  process.on("SIGTERM", handleShutdownSignal);
}

/** Creates the signal handler with injectable process boundaries for testing. */
export function createShutdownSignalHandler(
  server: FastifyInstance,
  dependencies: ShutdownHandlerDependencies = createShutdownDependencies(),
): (signal: NodeJS.Signals) => void {
  let shutdownStarted = false;

  return (signal) => {
    if (shutdownStarted) {
      dependencies.exitProcess(0);
      return;
    }

    shutdownStarted = true;
    const fallbackExit = dependencies.scheduleFallback(() => {
      dependencies.exitProcess(0);
    }, getShutdownFallbackMs(dependencies.observability));
    void closeServerAfterSignal(
      server,
      signal,
      dependencies.observability,
    ).then((exitCode) => {
      dependencies.clearFallback(fallbackExit);
      dependencies.exitProcess(exitCode);
    });
  };
}

function createShutdownDependencies(): ShutdownHandlerDependencies {
  return {
    clearFallback: clearTimeout,
    exitProcess,
    observability: createShutdownObservability(),
    scheduleFallback(callback, delayMs) {
      const timeout = setTimeout(callback, delayMs);
      timeout.unref();
      return timeout;
    },
  };
}

function createShutdownObservability(): ShutdownObservability {
  return {
    captureError: captureServerRuntimeError,
    enabled: isServerSentryRuntimeEnabled(),
    flush: flushServerSentry,
    recordEvent: recordServerRuntimeEvent,
  };
}

function getShutdownFallbackMs(observability: ShutdownObservability): number {
  return observability.enabled
    ? enabledShutdownFallbackMs
    : disabledShutdownFallbackMs;
}

function completeClosedServer(
  server: FastifyInstance,
  signal: NodeJS.Signals,
  flushSucceeded: boolean,
): ShutdownExitCode {
  if (!flushSucceeded) {
    server.log.error({ signal }, "Sentry telemetry did not flush in time.");
    return 1;
  }

  server.log.info("Azurite vein sealed. Backend shut down cleanly.");
  return 0;
}

async function flushAfterFastifyClose(
  context: ShutdownEventContext,
): Promise<boolean> {
  if (!context.observability.enabled) {
    return true;
  }

  return flushEnabledSentry(context);
}

async function flushEnabledSentry(
  context: ShutdownEventContext,
): Promise<boolean> {
  const { observability } = context;

  try {
    const flushSucceeded = await observability.flush(
      sentryShutdownFlushTimeoutMs,
    );
    return await recordAndDeliverFlushResult(context, flushSucceeded);
  } catch (error) {
    recordShutdownFailure(error, context);
    await deliverShutdownResult(context);
    return false;
  }
}

async function recordAndDeliverFlushResult(
  context: ShutdownEventContext,
  flushSucceeded: boolean,
): Promise<boolean> {
  const { observability } = context;
  observability.recordEvent(
    createShutdownEvent(
      runtimeObservabilityEventNames.shutdownFlushed,
      context,
      {
        [runtimeObservabilityAttributeNames.flushResult]: flushSucceeded,
      },
    ),
  );

  if (!flushSucceeded) {
    recordShutdownFailure(
      new Error("Sentry telemetry did not flush within its shutdown budget."),
      context,
    );
  }

  const resultDelivered = await deliverShutdownResult(context);
  return flushSucceeded && resultDelivered;
}

async function deliverShutdownResult(
  context: ShutdownEventContext,
): Promise<boolean> {
  try {
    return await context.observability.flush(
      sentryShutdownResultFlushTimeoutMs,
    );
  } catch {
    return false;
  }
}

function recordShutdownStarted(context: ShutdownEventContext): void {
  const { observability, signal } = context;

  if (!observability.enabled) {
    return;
  }

  observability.recordEvent({
    attributes: {
      [runtimeObservabilityAttributeNames.signal]: signal,
    },
    name: runtimeObservabilityEventNames.shutdownStarted,
    surface: "server",
  });
}

function recordShutdownFailure(
  error: unknown,
  context: ShutdownEventContext,
): void {
  const { observability } = context;

  if (!observability.enabled) {
    return;
  }

  observability.captureError(
    error,
    createShutdownEvent(
      runtimeObservabilityEventNames.shutdownFailed,
      context,
      { [runtimeObservabilityAttributeNames.resultStatus]: "failed" },
    ),
  );
}

function createShutdownEvent(
  name: string,
  context: ShutdownEventContext,
  attributes: Record<string, boolean | string>,
): RuntimeObservabilityEvent {
  const { signal, startedAt } = context;

  return {
    attributes: {
      ...attributes,
      [runtimeObservabilityAttributeNames.durationMs]: Math.max(
        0,
        Math.round(performance.now() - startedAt),
      ),
      [runtimeObservabilityAttributeNames.signal]: signal,
    },
    name,
    surface: "server",
  };
}

function exitProcess(exitCode: ShutdownExitCode): void {
  process.exit(exitCode);
}
