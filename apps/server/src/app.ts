import { createHealthCheckResponse } from "@azurite/shared";
import Fastify, { type FastifyInstance } from "fastify";

import { registerNotesRoute } from "./notes-route.js";
import {
  readServerOptionsFromEnvironment,
  type ServerOptions,
} from "./server-options.js";

const currentServerVersion = "0.0.0";

/** Creates the local Fastify server instance and registers API routes. */
export function createServer(
  options: ServerOptions = readServerOptionsFromEnvironment(),
): FastifyInstance {
  const server = Fastify({
    logger: true,
  });

  server.get("/health", () => createHealthCheckResponse(currentServerVersion));
  registerNotesRoute(server, options);

  return server;
}
