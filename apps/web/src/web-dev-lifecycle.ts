import type { Logger, ViteDevServer } from "vite";

type ShutdownExitCode = 0 | 1;

/** Minimal Vite server surface needed to shut the local web dev server down. */
export interface ClosableWebDevServer {
  close(): Promise<void>;
  config: {
    logger: Pick<Logger, "error" | "info">;
  };
}

const shutdownFallbackExitDelayMs = 500;

/** Closes the Vite dev server after an operating-system shutdown signal. */
export async function closeWebDevServerAfterSignal(
  server: ClosableWebDevServer,
  signal: NodeJS.Signals,
): Promise<ShutdownExitCode> {
  server.config.logger.info(
    `Shutting down local web dev server after ${signal}.`,
  );

  try {
    await server.close();
    server.config.logger.info(
      "Azurite vein sealed. Frontend shut down cleanly.",
    );
    return 0;
  } catch (error) {
    server.config.logger.error(
      `Failed to shut down local web dev server after ${signal}.`,
      { error: asError(error) },
    );
    return 1;
  }
}

/** Registers graceful shutdown handlers for the local Vite dev server. */
export function registerWebDevShutdown(server: ViteDevServer): void {
  const handleShutdownSignal = createShutdownSignalHandler(server);

  process.on("SIGINT", handleShutdownSignal);
  process.on("SIGTERM", handleShutdownSignal);
}

function createShutdownSignalHandler(
  server: ClosableWebDevServer,
): (signal: NodeJS.Signals) => void {
  let shutdownStarted = false;

  return (signal) => {
    if (shutdownStarted) {
      process.exit(0);
    }

    shutdownStarted = true;
    const fallbackExit = scheduleFallbackExit();
    void closeWebDevServerAfterSignal(server, signal).then((exitCode) => {
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

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function exitProcess(exitCode: ShutdownExitCode): never {
  process.exit(exitCode);
}
