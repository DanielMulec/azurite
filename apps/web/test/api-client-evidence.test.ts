import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiErrorCodes,
  requestIdSchema,
  runtimeObservabilityEventNames,
} from "@azurite/shared";
import { listNotes, WebApiError } from "../src/api-client.js";
import {
  captureWebRuntimeError,
  recordWebRuntimeEvent,
  runWebRuntimeSpan,
} from "../src/observability/web-runtime-observability.js";

vi.mock("../src/observability/web-runtime-observability.js", () => ({
  captureWebRuntimeError: vi.fn(),
  recordWebRuntimeEvent: vi.fn(),
  runWebRuntimeSpan: vi.fn((_event, callback: () => unknown) => callback()),
}));

const metadata = {
  requestId: requestIdSchema.parse("f1b24467-0b52-45e9-8e60-1d8d809a79dc"),
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("API request evidence", () => {
  it("records a well-formed API failure without capturing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: apiErrorCodes.workspaceNotConfigured,
                message: "Workspace path is not configured.",
              },
            }),
            { status: 500 },
          ),
        ),
      ),
    );

    await expect(listNotes(metadata)).rejects.toMatchObject({
      code: apiErrorCodes.workspaceNotConfigured,
      failureKind: "api_response",
    });
    expect(recordWebRuntimeEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: runtimeObservabilityEventNames.apiRequestFailed,
      }),
    );
    expect(captureWebRuntimeError).not.toHaveBeenCalled();
  });

  it.each([
    ["network", () => Promise.reject(new Error("offline"))],
    [
      "invalid JSON",
      () => Promise.resolve(new Response("not json", { status: 200 })),
    ],
    [
      "malformed error",
      () => Promise.resolve(new Response("{}", { status: 500 })),
    ],
    [
      "invalid success",
      () => Promise.resolve(new Response("{}", { status: 200 })),
    ],
  ])("captures one normalized %s failure", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn(response));

    const request = listNotes(metadata);
    await expect(request).rejects.toBeInstanceOf(WebApiError);
    expect(captureWebRuntimeError).toHaveBeenCalledOnce();
    expect(captureWebRuntimeError).toHaveBeenCalledWith(
      expect.any(WebApiError),
      expect.objectContaining({
        name: runtimeObservabilityEventNames.apiRequestFailed,
      }),
    );
  });

  it("uses the exact API span name and operation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              clusterIdentity: {
                clusterId: "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793",
                status: "ready",
              },
              notes: [],
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    await listNotes(metadata);
    expect(runWebRuntimeSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        spanName: "api.request",
        spanOperation: "azurite.api.request",
      }),
      expect.any(Function),
    );
  });
});
