import { describe, expect, it } from "vitest";

import {
  apiErrorCodes,
  apiErrorResponseSchema,
  createApiErrorResponse,
} from "../src/index.js";

describe("apiErrorResponseSchema", () => {
  it("accepts known safe error codes", () => {
    const response = createApiErrorResponse(
      apiErrorCodes.workspaceNotConfigured,
      "Workspace path is not configured.",
    );

    expect(apiErrorResponseSchema.parse(response)).toEqual({
      error: {
        code: apiErrorCodes.workspaceNotConfigured,
        message: "Workspace path is not configured.",
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
