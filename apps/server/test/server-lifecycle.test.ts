import { describe, expect, it } from "vitest";

import { createServer } from "../src/app.js";
import { closeServerAfterSignal } from "../src/server-lifecycle.js";

describe("closeServerAfterSignal", () => {
  it("closes the backend and reports a clean shutdown", async () => {
    const server = createServer({});
    await server.listen({ host: "127.0.0.1", port: 0 });

    const exitCode = await closeServerAfterSignal(server, "SIGINT");

    expect(exitCode).toBe(0);
    expect(server.server.listening).toBe(false);
  });
});
