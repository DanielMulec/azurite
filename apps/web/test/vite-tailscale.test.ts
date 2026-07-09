import { request } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type ViteDevServer } from "vite";

import { repositoryRoot, viteConfiguration } from "../vite.config.js";

const magicDnsHost = "azurite-test.example.ts.net";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Vite Tailscale support", () => {
  it("loads root env and keeps API proxy targets on localhost", () => {
    expect(viteConfiguration.envDir).toBe(repositoryRoot);
    expect(viteConfiguration.server.proxy).toMatchObject({
      "/__azurite/dev/sentry-test-event": "http://127.0.0.1:3000",
      "/api": "http://127.0.0.1:3000",
      "/health": "http://127.0.0.1:3000",
    });
  });

  it("accepts the current-session MagicDNS host through Vite's allowlist", async () => {
    vi.stubEnv("__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS", magicDnsHost);
    const server = await createServer({
      configFile: new URL("../vite.config.ts", import.meta.url).pathname,
      server: { host: "127.0.0.1", port: 0 },
    });

    try {
      await server.listen();
      const port = readListeningPort(server);

      await expect(requestWithHost(port, magicDnsHost)).resolves.toBe(200);
      await expect(
        requestWithHost(port, "unapproved.example.invalid"),
      ).resolves.toBe(403);
    } finally {
      await server.close();
    }
  });
});

function readListeningPort(server: ViteDevServer): number {
  const httpServer = server.httpServer;

  if (httpServer === null) {
    throw new Error("Vite did not create an HTTP server.");
  }

  return readTcpPort(httpServer.address());
}

function readTcpPort(
  address: ReturnType<NonNullable<ViteDevServer["httpServer"]>["address"]>,
): number {
  if (address === null) {
    throw new Error("Vite did not expose a local TCP test address.");
  }

  if (typeof address === "string") {
    throw new Error("Vite exposed a non-TCP test address.");
  }

  return address.port;
}

function requestWithHost(port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const clientRequest = request(
      {
        headers: { Host: host },
        host: "127.0.0.1",
        path: "/",
        port,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    clientRequest.on("error", reject);
    clientRequest.end();
  });
}
