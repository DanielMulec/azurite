import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createContentHash } from "@azurite/core";
import {
  apiErrorCodes,
  apiRoutes,
  createNoteContentRoute,
  runtimeObservabilityEventNames as events,
} from "@azurite/shared";
import type { FastifyInstance } from "fastify";

const forcedFailure = vi.hoisted(() => ({
  error: new Error("forced route failure"),
  operation: "none",
}));

vi.mock("@azurite/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@azurite/core")>();
  return {
    ...actual,
    async listWorkspaceNotes(workspacePath: string) {
      throwWhenForced("list");
      return await actual.listWorkspaceNotes(workspacePath);
    },
    async readWorkspaceNote(workspacePath: string, noteId: string) {
      throwWhenForced("read");
      return await actual.readWorkspaceNote(workspacePath, noteId);
    },
    async writeWorkspaceNote(
      workspacePath: string,
      input: Parameters<typeof actual.writeWorkspaceNote>[1],
    ) {
      throwWhenForced("save");
      return await actual.writeWorkspaceNote(workspacePath, input);
    },
  };
});

import { createServer } from "../src/app.js";
import { parseServerSentryConfig } from "../src/config/sentry-config.js";
import {
  installServerSentryRuntime,
  resetServerSentryRuntimeForTests,
  type ServerSentrySdk,
} from "../src/observability/server-runtime-observability.js";

afterEach(() => {
  forcedFailure.operation = "none";
  resetServerSentryRuntimeForTests();
});

describe("unexpected note route evidence", () => {
  it.each([
    ["list", events.notesListFailed, apiErrorCodes.noteDiscoveryFailed],
    ["read", events.noteReadFailed, apiErrorCodes.noteReadFailed],
    ["save", events.noteSaveFailed, apiErrorCodes.noteWriteFailed],
  ] as const)(
    "captures the original unexpected %s error once",
    async (operation, eventName, apiCode) => {
      await withWorkspace(async (workspacePath) => {
        await writeFile(path.join(workspacePath, "index.md"), "# Home\n");
        forcedFailure.operation = operation;
        const fake = installFakeRuntime();
        const response = await unexpectedRequests[operation](
          createServer({ workspacePath }),
        );

        expect(response.statusCode).toBe(500);
        expect(eventAttributes(fake.errorLog, eventName)).toMatchObject({
          "azurite.api_error_code": apiCode,
          "azurite.result_status": "failed",
          "http.response.status_code": 500,
        });
        expect(fake.captureException).toHaveBeenCalledOnce();
        expect(fake.captureException).toHaveBeenCalledWith(forcedFailure.error);
      });
    },
  );
});

const unexpectedRequests = {
  list: (server: FastifyInstance) =>
    server.inject({ method: "GET", url: apiRoutes.notes }),
  read: (server: FastifyInstance) =>
    server.inject({ method: "GET", url: createNoteContentRoute("index.md") }),
  save: (server: FastifyInstance) =>
    server.inject({
      headers: { "content-type": "application/json" },
      method: "PUT",
      payload: JSON.stringify({
        expectedContentHash: createContentHash("# Home\n"),
        markdown: "# Saved\n",
        noteId: "index.md",
      }),
      url: apiRoutes.noteContent,
    }),
};

function throwWhenForced(operation: "list" | "read" | "save"): void {
  if (forcedFailure.operation === operation) {
    throw forcedFailure.error;
  }
}

function installFakeRuntime() {
  const captureException = vi.fn(() => "event-id");
  const errorLog = vi.fn();
  const sdk: ServerSentrySdk = {
    addBreadcrumb: vi.fn(),
    captureException,
    flush: vi.fn(() => Promise.resolve(true)),
    logger: { error: errorLog, info: vi.fn() },
    startSpan<Result>(_options: unknown, callback: () => Result): Result {
      return callback();
    },
    withScope(callback) {
      callback({ setContext: vi.fn(), setTag: vi.fn() });
    },
  };
  installServerSentryRuntime(
    sdk,
    parseServerSentryConfig({
      SENTRY_DSN: "https://public@example.invalid/1",
      SENTRY_ENABLED: "true",
    }),
  );
  return { captureException, errorLog };
}

function eventAttributes(
  logger: ReturnType<typeof vi.fn>,
  eventName: string,
): Record<string, unknown> {
  const call = logger.mock.calls.find(([name]) => name === eventName);
  if (call === undefined) {
    throw new Error(`Expected ${eventName} evidence.`);
  }
  return call[1] as Record<string, unknown>;
}

async function withWorkspace(
  callback: (workspacePath: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "azurite-route-failure-"));
  const workspacePath = path.join(root, "workspace");
  await mkdir(workspacePath);
  try {
    await callback(workspacePath);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}
