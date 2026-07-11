import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createContentHash } from "@azurite/core";
import {
  apiRoutes,
  apiErrorCodes,
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
      expect(fake.spanOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "note.read",
          op: "azurite.server.route",
        }),
      );
      expect(fake.captureException).not.toHaveBeenCalled();
    });
  });
});

describe("note-list success evidence", () => {
  it("records joined note-list success evidence", async () => {
    await withWorkspace(async (workspacePath) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n");
      const fake = installFakeRuntime();
      const listResponse = await createServer({ workspacePath }).inject({
        headers: { [correlationHeaderNames.requestId]: requestId },
        method: "GET",
        url: apiRoutes.notes,
      });

      expect(listResponse.statusCode).toBe(200);
      expect(
        eventAttributes(
          fake.info,
          runtimeObservabilityEventNames.notesListSucceeded,
        ),
      ).toMatchObject({
        "azurite.note_count": 1,
        "azurite.request_id": requestId,
        "azurite.result_status": "succeeded",
        "http.response.status_code": 200,
      });
      expect(fake.spanOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "notes.list",
          op: "azurite.server.route",
        }),
      );
    });
  });
});

describe("note-save success evidence", () => {
  it("records joined note-save success evidence", async () => {
    await withWorkspace(async (workspacePath) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n");
      const fake = installFakeRuntime();
      const saveResponse = await createServer({ workspacePath }).inject({
        headers: {
          "content-type": "application/json",
          [correlationHeaderNames.noteOperationId]: operationId,
          [correlationHeaderNames.requestId]: requestId,
        },
        method: "PUT",
        payload: JSON.stringify({
          expectedContentHash: createContentHash("# Home\n"),
          markdown: "# Saved\n",
          noteId: "index.md",
        }),
        url: apiRoutes.noteContent,
      });

      expect(saveResponse.statusCode).toBe(200);
      expect(
        eventAttributes(
          fake.info,
          runtimeObservabilityEventNames.noteSaveSucceeded,
        ),
      ).toMatchObject({
        "azurite.content_hash": createContentHash("# Saved\n"),
        "azurite.note_operation_id": operationId,
        "azurite.request_id": requestId,
        "azurite.result_status": "succeeded",
      });
      expect(fake.spanOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "note.save",
          op: "azurite.server.route",
        }),
      );
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

describe("expected save route evidence", () => {
  it("records invalid-save and save-not-found outcomes without capture", async () => {
    await withWorkspace(async (workspacePath) => {
      const fake = installFakeRuntime();
      const server = createServer({ workspacePath });

      await server.inject({ method: "GET", url: apiRoutes.notes });
      await server.inject({
        headers: { "content-type": "application/json" },
        method: "PUT",
        payload: JSON.stringify({ markdown: "# Invalid" }),
        url: apiRoutes.noteContent,
      });
      await server.inject({
        headers: { "content-type": "application/json" },
        method: "PUT",
        payload: JSON.stringify({
          expectedContentHash: createContentHash("# Missing\n"),
          markdown: "# Saved\n",
          noteId: "missing.md",
        }),
        url: apiRoutes.noteContent,
      });

      expect(eventNames(fake.info)).toEqual(
        expect.arrayContaining([
          runtimeObservabilityEventNames.notesListSucceeded,
          runtimeObservabilityEventNames.noteSaveInvalid,
          runtimeObservabilityEventNames.noteSaveNotFound,
        ]),
      );
      expect(
        eventAttributes(
          fake.info,
          runtimeObservabilityEventNames.noteSaveInvalid,
        ),
      ).toMatchObject({
        "azurite.api_error_code": apiErrorCodes.invalidNoteSave,
      });
      expect(fake.captureException).not.toHaveBeenCalled();
    });
  });
});

describe("expected workspace route evidence", () => {
  it("records missing and invalid workspace outcomes without capture", async () => {
    const fake = installFakeRuntime();
    const missingResponse = await createServer({}).inject({
      method: "GET",
      url: apiRoutes.notes,
    });
    const invalidResponse = await createServer({
      workspacePath: path.join(tmpdir(), `azurite-missing-${randomUUID()}`),
    }).inject({ method: "GET", url: apiRoutes.notes });

    expect(missingResponse.statusCode).toBe(500);
    expect(invalidResponse.statusCode).toBe(500);
    const failures = allEventAttributes(
      fake.info,
      runtimeObservabilityEventNames.notesListFailed,
    );
    expect(failures).toHaveLength(2);
    expect(
      failures.map((attributes) => attributes["azurite.api_error_code"]),
    ).toEqual([
      apiErrorCodes.workspaceNotConfigured,
      apiErrorCodes.invalidWorkspace,
    ]);
    expect(fake.captureException).not.toHaveBeenCalled();
  });
});

describe("concurrent note route evidence", () => {
  it("keeps concurrent Fastify correlation contexts independent", async () => {
    await withWorkspace(async (workspacePath) => {
      await writeFile(path.join(workspacePath, "index.md"), "# Home\n");
      const fake = installFakeRuntime();
      const server = createServer({ workspacePath });
      const secondRequestId = "dde1de07-3015-44ae-b783-bc326e360a55";
      const secondOperationId = "266c4372-08da-4683-a475-c23256fa031a";

      await Promise.all([
        server.inject({
          headers: {
            [correlationHeaderNames.noteOperationId]: operationId,
            [correlationHeaderNames.requestId]: requestId,
          },
          method: "GET",
          url: createNoteContentRoute("index.md"),
        }),
        server.inject({
          headers: {
            [correlationHeaderNames.noteOperationId]: secondOperationId,
            [correlationHeaderNames.requestId]: secondRequestId,
          },
          method: "GET",
          url: createNoteContentRoute("index.md"),
        }),
      ]);

      const starts = allEventAttributes(
        fake.info,
        runtimeObservabilityEventNames.noteReadStarted,
      );
      expect(starts).toHaveLength(2);
      expect(
        starts.map((attributes) => attributes["azurite.request_id"]).sort(),
      ).toEqual([requestId, secondRequestId].sort());
      expect(
        starts
          .map((attributes) => attributes["azurite.note_operation_id"])
          .sort(),
      ).toEqual([operationId, secondOperationId].sort());
    });
  });
});

function installFakeRuntime() {
  const info = vi.fn();
  const captureException = vi.fn(() => "event-id");
  const spanOptions = vi.fn();
  const scope = { setContext: vi.fn(), setTag: vi.fn() };
  const sdk: ServerSentrySdk = {
    addBreadcrumb: vi.fn(),
    captureException,
    flush: vi.fn(() => Promise.resolve(true)),
    logger: { error: vi.fn(), info },
    startSpan<Result>(options: unknown, callback: () => Result): Result {
      spanOptions(options);
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
  return { captureException, info, spanOptions };
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

function allEventAttributes(
  info: ReturnType<typeof vi.fn>,
  name: string,
): Record<string, unknown>[] {
  return info.mock.calls
    .filter(([eventName]) => eventName === name)
    .map((call) => call[1] as Record<string, unknown>);
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
