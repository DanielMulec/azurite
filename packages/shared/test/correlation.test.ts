import { describe, expect, expectTypeOf, it } from "vitest";

import {
  correlationFailureReasons,
  correlationHeaderNames,
  correlationIdKinds,
  noteOperationIdSchema,
  noteOperationIdStatuses,
  parseNoteOperationIdHeader,
  parseRequestIdHeader,
  requestIdSchema,
  requestIdSources,
  type NoteOperationId,
  type RequestId,
} from "../src/index.js";

const requestId = "6f9619ff-8b86-4d7e-a4a2-47b03c4e5f10";
const operationId = "550e8400-e29b-41d4-a716-446655440000";

describe("correlation contracts", () => {
  it("exports exact bounded constants", () => {
    expect(correlationHeaderNames).toEqual({
      noteOperationId: "x-azurite-note-operation-id",
      requestId: "x-azurite-request-id",
    });
    expect(correlationFailureReasons).toEqual({
      cryptoUnavailable: "crypto_unavailable",
      randomValuesFailed: "random_values_failed",
      randomValuesUnavailable: "random_values_unavailable",
      uuidInvalid: "uuid_invalid",
    });
    expect(correlationIdKinds).toEqual({
      noteOperation: "note_operation",
      request: "request",
    });
    expect(noteOperationIdStatuses).toEqual({
      accepted: "accepted",
      invalid: "invalid",
      missing: "missing",
    });
    expect(requestIdSources).toEqual({
      client: "client",
      serverInvalid: "server_invalid",
      serverMissing: "server_missing",
    });
  });

  it("brands request and operation IDs distinctly", () => {
    const parsedRequestId = requestIdSchema.parse(requestId);
    const parsedOperationId = noteOperationIdSchema.parse(operationId);

    expectTypeOf(parsedRequestId).toEqualTypeOf<RequestId>();
    expectTypeOf(parsedOperationId).toEqualTypeOf<NoteOperationId>();
    expectTypeOf<RequestId>().not.toEqualTypeOf<NoteOperationId>();
  });

  it.each([
    [undefined, "missing"],
    [[requestId], "invalid"],
    [`${requestId}, ${operationId}`, "invalid"],
    [` ${requestId}`, "invalid"],
    [requestId.replace("4d7e", "7d7e"), "invalid"],
    ["not-a-uuid", "invalid"],
    ["x".repeat(256), "invalid"],
  ] as const)("classifies rejected request header %j", (input, status) => {
    expect(parseRequestIdHeader(input)).toEqual({ status });
  });

  it("accepts exact UUID-v4 headers with distinct brands", () => {
    expect(parseRequestIdHeader(requestId)).toEqual({
      status: "accepted",
      value: requestId,
    });
    expect(parseNoteOperationIdHeader(operationId)).toEqual({
      status: "accepted",
      value: operationId,
    });
  });
});
