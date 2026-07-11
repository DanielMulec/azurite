import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createContentHash } from "@azurite/core";
import {
  apiRoutes,
  correlationHeaderNames,
  createNoteContentRoute,
  runtimeObservabilityEventNames,
} from "@azurite/shared";
import { createServer } from "../src/app.js";
import { parseServerSentryConfig } from "../src/config/sentry-config.js";
import {
  installServerSentryRuntime,
  resetServerSentryRuntimeForTests,
  type ServerSentrySdk,
} from "../src/observability/server-runtime-observability.js";

const requestId = "4f1e6420-59bf-4ec0-b51e-64308be18fee";
const operationId = "30be2dc8-5ff8-46df-838a-d56170c0b752";

afterEach(() => {
  resetServerSentryRuntimeForTests();
});

describe("note route evidence", () => {
  it("joins accepted headers across read start and success", async () => {
    await withWorkspace(async (workspacePath) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n");
      const fake = installFakeRuntime();
      const response = await createServer({ workspacePath }).inject({
        headers: {
          [correlationHeaderNames.noteOperationId]: operationId,
          [correlationHeaderNames.requestId]: requestId,
        },
        method: "GET",
        url: createNoteContentRoute("index.md"),
      });

      expect(response.statusCode).toBe(200);
      expect(
        eventAttributes(
          fake.info,
          runtimeObservabilityEventNames.noteReadStarted,
        ),
      ).toMatchObject({
        "azurite.note_operation_id": operationId,
        "azurite.note_operation_id_status": "accepted",
        "azurite.request_id": requestId,
        "azurite.request_id_source": "client",
        "http.method": "GET",
        "http.route": apiRoutes.noteContent,
      });
      expect(
        eventAttributes(
          fake.info,
          runtimeObservabilityEventNames.noteReadSucceeded,
        ),
      ).toMatchObject({
        "azurite.note_operation_id": operationId,
        "azurite.request_id": requestId,
        "azurite.result_status": "succeeded",
      });
      expect(fake.captureException).not.toHaveBeenCalled();
    });
  });
});

describe("expected note route evidence", () => {
  it("records expected invalid, missing, and conflict results without capture", async () => {
    await withWorkspace(async (workspacePath) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Changed\n");
      const fake = installFakeRuntime();
      const server = createServer({ workspacePath });

      await server.inject({ method: "GET", url: apiRoutes.noteContent });
      await server.inject({
        method: "GET",
        url: createNoteContentRoute("missing.md"),
      });
      await server.inject({
        headers: { "content-type": "application/json" },
        method: "PUT",
        payload: JSON.stringify({
          expectedContentHash: createContentHash("# Old\n"),
          markdown: "# Mine\n",
          noteId: "index.md",
        }),
        url: apiRoutes.noteContent,
      });

      expect(eventNames(fake.info)).toEqual(
        expect.arrayContaining([
          runtimeObservabilityEventNames.noteReadInvalid,
          runtimeObservabilityEventNames.noteReadNotFound,
          runtimeObservabilityEventNames.noteSaveConflicted,
        ]),
      );
      expect(fake.captureException).not.toHaveBeenCalled();
    });
  });
});

function installFakeRuntime() {
  const info = vi.fn();
  const captureException = vi.fn(() => "event-id");
  const scope = { setContext: vi.fn(), setTag: vi.fn() };
  const sdk: ServerSentrySdk = {
    addBreadcrumb: vi.fn(),
    captureException,
    flush: vi.fn(() => Promise.resolve(true)),
    logger: { error: vi.fn(), info },
    startSpan<Result>(_options: unknown, callback: () => Result): Result {
      return callback();
    },
    withScope(callback) {
      callback(scope);
    },
  };
  installServerSentryRuntime(
    sdk,
    parseServerSentryConfig({
      SENTRY_DSN: "https://public@example.invalid/1",
      SENTRY_ENABLED: "true",
    }),
  );
  return { captureException, info };
}

function eventNames(info: ReturnType<typeof vi.fn>): string[] {
  return info.mock.calls.map((call) => String(call[0]));
}

function eventAttributes(
  info: ReturnType<typeof vi.fn>,
  name: string,
): Record<string, unknown> {
  const call = info.mock.calls.find(([eventName]) => eventName === name);
  expect(call).toBeDefined();
  return call?.[1] as Record<string, unknown>;
}

async function withWorkspace(
  callback: (workspacePath: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "azurite-evidence-"));
  const workspacePath = path.join(root, "workspace");
  await mkdir(workspacePath);
  try {
    await callback(workspacePath);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}
