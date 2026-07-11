import { afterEach, describe, expect, it, vi } from "vitest";

import { runtimeObservabilityEventNames } from "@azurite/shared";
import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import {
  installWebSentryRuntime,
  recordWebRuntimeEvent,
  resetWebSentryRuntimeForTests,
  type WebSentrySdk,
} from "../src/observability/web-runtime-observability.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createMemoryDraftPersistence,
  createNote,
  createSeededStore,
  readyClusterIdentity,
  requireMockCall,
} from "./note-browser-store-test-helpers.js";

afterEach(() => {
  resetWebSentryRuntimeForTests();
});

describe("overlapping browser evidence", () => {
  it("keeps stale read identity closure-owned and leaves no event residue", async () => {
    const info = installFakeRuntime();
    const home = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const project = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>((noteId) =>
      noteId === "index.md" ? home.promise : project.promise,
    );
    const store = createSeededStore({
      api: createApi({ readNote }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });

    const staleLoad = store.getState().selectNote("index.md");
    const currentLoad = store.getState().selectNote("Projects/azurite.md");
    project.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("Projects/azurite.md", "# Project", "sha256-project"),
    });
    await currentLoad;
    home.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Home", "sha256-home"),
    });
    await staleLoad;

    const firstMetadata = requireMockCall(readNote.mock.calls, 0)[1];
    const secondMetadata = requireMockCall(readNote.mock.calls, 1)[1];
    const staleAttributes = findEventAttributes(
      info,
      runtimeObservabilityEventNames.noteLoadStaleIgnored,
    );
    expect(staleAttributes).toMatchObject({
      "azurite.note_id": "index.md",
      "azurite.note_operation_id": firstMetadata.noteOperationId,
      "azurite.request_id": firstMetadata.requestId,
      "azurite.stale_completion": "succeeded",
      "azurite.ui_request_sequence": 1,
    });
    expect(staleAttributes["azurite.request_id"]).not.toBe(
      secondMetadata.requestId,
    );

    recordWebRuntimeEvent({ name: "unrelated.runtime", surface: "web" });
    const unrelatedAttributes = findEventAttributes(info, "unrelated.runtime");
    expect(unrelatedAttributes).not.toHaveProperty("azurite.note_id");
    expect(unrelatedAttributes).not.toHaveProperty("azurite.request_id");
  });
});

describe("stale failed browser evidence", () => {
  it("keeps the failed read attached to its original closure", async () => {
    const info = installFakeRuntime();
    const home = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const project = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>((noteId) =>
      noteId === "index.md" ? home.promise : project.promise,
    );
    const store = createSeededStore({ api: createApi({ readNote }) });

    const staleLoad = store.getState().selectNote("index.md");
    const currentLoad = store.getState().selectNote("Projects/azurite.md");
    project.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("Projects/azurite.md", "# Project", "sha256-project"),
    });
    await currentLoad;
    home.reject(new Error("stale read failed"));
    await staleLoad;

    const firstMetadata = requireMockCall(readNote.mock.calls, 0)[1];
    expect(
      findEventAttributes(
        info,
        runtimeObservabilityEventNames.noteLoadStaleIgnored,
      ),
    ).toMatchObject({
      "azurite.note_id": "index.md",
      "azurite.note_operation_id": firstMetadata.noteOperationId,
      "azurite.request_id": firstMetadata.requestId,
      "azurite.stale_completion": "failed",
      "azurite.ui_request_sequence": 1,
    });
  });
});

function installFakeRuntime() {
  const info = vi.fn();
  const sdk: WebSentrySdk = {
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(() => "event-id"),
    logger: { error: vi.fn(), info },
    startSpan<Result>(_options: unknown, callback: () => Result): Result {
      return callback();
    },
    withScope(callback) {
      callback({ setContext: vi.fn(), setTag: vi.fn() });
    },
  };
  installWebSentryRuntime(
    sdk,
    parseWebSentryConfig({
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      VITE_SENTRY_ENABLED: "true",
    }),
  );
  return info;
}

function findEventAttributes(
  info: ReturnType<typeof vi.fn>,
  eventName: string,
): Record<string, unknown> {
  const call = info.mock.calls.find(([name]) => name === eventName);
  expect(call).toBeDefined();
  return call?.[1] as Record<string, unknown>;
}
