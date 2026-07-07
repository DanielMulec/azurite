import { describe, expect, it } from "vitest";

import { createHealthCheckResponse } from "../src/index.js";

describe("createHealthCheckResponse", () => {
  it("returns a valid health check response", () => {
    expect(createHealthCheckResponse("0.0.0")).toEqual({
      service: "azurite",
      status: "ok",
      version: "0.0.0",
    });
  });
});
