import { describe, expect, it } from "vitest";

import {
  type ClosableWebDevServer,
  closeWebDevServerAfterSignal,
} from "../src/web-dev-lifecycle.js";

describe("closeWebDevServerAfterSignal", () => {
  it("closes the local web dev server and reports a clean shutdown", async () => {
    const closeCalls: string[] = [];
    const messages: string[] = [];
    const server = createClosableWebDevServer(closeCalls, messages);

    const exitCode = await closeWebDevServerAfterSignal(server, "SIGINT");

    expect(exitCode).toBe(0);
    expect(closeCalls).toEqual(["close"]);
    expect(messages).toContain(
      "Azurite vein sealed. Web dev server shut down cleanly.",
    );
  });
});

function createClosableWebDevServer(
  closeCalls: string[],
  messages: string[],
): ClosableWebDevServer {
  return {
    close() {
      closeCalls.push("close");
      return Promise.resolve();
    },
    config: {
      logger: {
        error(message) {
          messages.push(message);
        },
        info(message) {
          messages.push(message);
        },
      },
    },
  };
}
