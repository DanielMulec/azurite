import { createHealthCheckResponse } from "@azurite/shared";
import Fastify, { type FastifyInstance } from "fastify";

const currentServerVersion = "0.0.0";

export function createServer(): FastifyInstance {
  const server = Fastify({
    logger: true,
  });

  server.get("/health", () => createHealthCheckResponse(currentServerVersion));

  return server;
}
