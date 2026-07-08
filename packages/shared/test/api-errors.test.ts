import { describe, expect, it } from "vitest";

import {
  apiErrorCodes,
  apiErrorResponseSchema,
  createApiErrorResponse,
} from "../src/index.js";

describe("apiErrorResponseSchema", () => {
  it("accepts known safe error codes", () => {
    const response = createApiErrorResponse(
      apiErrorCodes.noteWriteConflict,
      "The note changed on disk.",
    );

    expect(apiErrorResponseSchema.parse(response)).toEqual({
      error: {
        code: apiErrorCodes.noteWriteConflict,
        message: "The note changed on disk.",
      },
    });
  });

  it("rejects unknown error codes", () => {
    expect(() =>
      apiErrorResponseSchema.parse({
        error: {
          code: "surprise_failure",
          message: "Unexpected error code.",
        },
      }),
    ).toThrow();
  });
});
