import { apiRoutes, createHealthCheckResponse } from "@azurite/shared";
import Fastify, { type FastifyInstance } from "fastify";

import {
  readServerSentryConfig,
  type ServerSentryConfig,
} from "./config/sentry-config.js";
import { registerDevSentryTestRoute } from "./dev-sentry-test-route.js";
import { registerNotesRoute } from "./notes-route.js";
import { registerRuntimeTraceEvidence } from "./observability/runtime-trace-evidence.js";
import {
  readServerOptionsFromEnvironment,
  type ServerOptions,
} from "./server-options.js";

const currentServerVersion = "0.0.0";

/** Creates the local Fastify server instance and registers API routes. */
export function createServer(
  options: ServerOptions = readServerOptionsFromEnvironment(),
  sentryConfig: ServerSentryConfig = readServerSentryConfig(),
): FastifyInstance {
  const server = Fastify({
    logger: true,
  });

  server.get(apiRoutes.health, () =>
    createHealthCheckResponse(currentServerVersion),
  );
  registerNotesRoute(server, options);
  registerRuntimeTraceEvidence(server, sentryConfig);
  registerDevSentryTestRoute(server, sentryConfig);

  return server;
}
