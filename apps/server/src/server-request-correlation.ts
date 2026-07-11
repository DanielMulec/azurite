import { randomUUID } from "node:crypto";

import {
  correlationHeaderNames,
  noteOperationIdStatuses,
  parseNoteOperationIdHeader,
  parseRequestIdHeader,
  requestIdSchema,
  requestIdSources,
  type NoteOperationId,
  type RequestId,
} from "@azurite/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";

/** Immutable correlation authority attached to one Fastify request. */
export type ServerRequestCorrelation = {
  readonly noteOperationId?: NoteOperationId;
  readonly noteOperationIdStatus: (typeof noteOperationIdStatuses)[keyof typeof noteOperationIdStatuses];
  readonly requestId: RequestId;
  readonly requestIdSource: (typeof requestIdSources)[keyof typeof requestIdSources];
};

declare module "fastify" {
  interface FastifyRequest {
    azuriteCorrelation: ServerRequestCorrelation | null;
  }
}

/** Installs early, request-local parsing for Azurite correlation headers. */
export function registerServerRequestCorrelation(
  server: FastifyInstance,
): void {
  server.decorateRequest("azuriteCorrelation", null);
  server.addHook("onRequest", (request, _reply, done) => {
    request.azuriteCorrelation = createServerRequestCorrelation(
      request.headers,
    );
    done();
  });
}

/** Reads correlation after the registered onRequest hook has initialized it. */
export function getServerRequestCorrelation(
  request: FastifyRequest,
): ServerRequestCorrelation {
  if (request.azuriteCorrelation === null) {
    throw new Error(
      "Server request correlation was read before initialization.",
    );
  }

  return request.azuriteCorrelation;
}

/** Creates one frozen correlation value from defensive header input. */
export function createServerRequestCorrelation(
  headers: Readonly<Record<string, string | readonly string[] | undefined>>,
): ServerRequestCorrelation {
  const parsedRequestId = parseRequestIdHeader(
    headers[correlationHeaderNames.requestId],
  );
  const parsedOperationId = parseNoteOperationIdHeader(
    headers[correlationHeaderNames.noteOperationId],
  );
  const requestId =
    parsedRequestId.status === "accepted"
      ? parsedRequestId.value
      : requestIdSchema.parse(randomUUID());

  return Object.freeze({
    ...(parsedOperationId.status === "accepted"
      ? { noteOperationId: parsedOperationId.value }
      : {}),
    noteOperationIdStatus: parsedOperationId.status,
    requestId,
    requestIdSource:
      parsedRequestId.status === "accepted"
        ? requestIdSources.client
        : parsedRequestId.status === "invalid"
          ? requestIdSources.serverInvalid
          : requestIdSources.serverMissing,
  });
}
