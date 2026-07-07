import { describe, expect, it } from "vitest";

import { createServer } from "../src/app.js";

describe("health route", () => {
  it("returns the server health response", async () => {
    const server = createServer();
    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "azurite",
      status: "ok",
      version: "0.0.0",
    });
  });
});
