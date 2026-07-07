import type { FastifyInstance } from "fastify";

type ShutdownExitCode = 0 | 1;

const shutdownFallbackExitDelayMs = 500;

/** Closes the Fastify server after an operating-system shutdown signal. */
export async function closeServerAfterSignal(
  server: FastifyInstance,
  signal: NodeJS.Signals,
): Promise<ShutdownExitCode> {
  server.log.info({ signal }, "Shutting down local server.");

  try {
    await server.close();
    return 0;
  } catch (error) {
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

function createShutdownSignalHandler(
  server: FastifyInstance,
): (signal: NodeJS.Signals) => void {
  let shutdownStarted = false;

  return (signal) => {
    if (shutdownStarted) {
      process.exit(0);
    }

    shutdownStarted = true;
    const fallbackExit = scheduleFallbackExit();
    void closeServerAfterSignal(server, signal).then((exitCode) => {
      clearTimeout(fallbackExit);
      exitProcess(exitCode);
    });
  };
}

function scheduleFallbackExit(): NodeJS.Timeout {
  const timeout = setTimeout(() => {
    process.exit(0);
  }, shutdownFallbackExitDelayMs);
  timeout.unref();

  return timeout;
}

function exitProcess(exitCode: ShutdownExitCode): never {
  process.exit(exitCode);
}
