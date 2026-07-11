import { describe, expect, it } from "vitest";

import {
  correlationHeaderNames,
  noteOperationIdStatuses,
  requestIdSources,
} from "@azurite/shared";
import { createServer } from "../src/app.js";
import {
  createServerRequestCorrelation,
  getServerRequestCorrelation,
} from "../src/server-request-correlation.js";

const requestId = "4f1e6420-59bf-4ec0-b51e-64308be18fee";
const operationId = "30be2dc8-5ff8-46df-838a-d56170c0b752";

describe("createServerRequestCorrelation", () => {
  it("accepts exact UUID-v4 values and freezes fresh context", () => {
    const correlation = createServerRequestCorrelation({
      [correlationHeaderNames.noteOperationId]: operationId,
      [correlationHeaderNames.requestId]: requestId,
    });

    expect(correlation).toEqual({
      noteOperationId: operationId,
      noteOperationIdStatus: noteOperationIdStatuses.accepted,
      requestId,
      requestIdSource: requestIdSources.client,
    });
    expect(Object.isFrozen(correlation)).toBe(true);
  });

  it.each([
    "not-a-uuid",
    ` ${requestId}`,
    `${requestId},${requestId}`,
    "8e1c5008-2693-11f1-a1f6-33474cdc6879",
    "x".repeat(512),
  ])("replaces invalid request input without retaining it: %s", (value) => {
    const correlation = createServerRequestCorrelation({
      [correlationHeaderNames.noteOperationId]: value,
      [correlationHeaderNames.requestId]: value,
    });

    expect(correlation).toMatchObject({
      noteOperationIdStatus: noteOperationIdStatuses.invalid,
      requestIdSource: requestIdSources.serverInvalid,
    });
    expect(correlation.requestId).not.toBe(value);
    expect(correlation).not.toHaveProperty("noteOperationId");
  });

  it("classifies missing and defensive array inputs", () => {
    expect(createServerRequestCorrelation({})).toMatchObject({
      noteOperationIdStatus: noteOperationIdStatuses.missing,
      requestIdSource: requestIdSources.serverMissing,
    });
    expect(
      createServerRequestCorrelation({
        [correlationHeaderNames.noteOperationId]: [operationId],
        [correlationHeaderNames.requestId]: [requestId],
      }),
    ).toMatchObject({
      noteOperationIdStatus: noteOperationIdStatuses.invalid,
      requestIdSource: requestIdSources.serverInvalid,
    });
  });
});

describe("Fastify request correlation", () => {
  it("creates isolated immutable contexts before route handlers", async () => {
    const server = createServer({});
    const seen: unknown[] = [];
    server.addHook("preHandler", (request, _reply, done) => {
      seen.push(getServerRequestCorrelation(request));
      done();
    });

    await Promise.all([
      server.inject({
        headers: { [correlationHeaderNames.requestId]: requestId },
        method: "GET",
        url: "/api/notes",
      }),
      server.inject({ method: "GET", url: "/api/notes" }),
    ]);

    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen.every((value) => Object.isFrozen(value))).toBe(true);
  });

  it("leaves oversized transport headers to Node before application hooks", async () => {
    const server = createServer({});
    let applicationRequests = 0;
    server.addHook("onRequest", (_request, _reply, done) => {
      applicationRequests += 1;
      done();
    });
    const address = await server.listen({ host: "127.0.0.1", port: 0 });

    try {
      const response = await fetch(`${address}/api/notes`, {
        headers: { [correlationHeaderNames.requestId]: "x".repeat(32_768) },
      });
      expect(response.status).toBe(431);
      expect(applicationRequests).toBe(0);
    } finally {
      await server.close();
    }
  });
});
