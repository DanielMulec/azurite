import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiErrorCodes,
  noteRouteSources,
  requestIdSchema,
  runtimeObservabilityEventNames as events,
  type ListNotesResponse,
} from "@azurite/shared";
import { WebApiError } from "../src/api-client.js";
import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import {
  installWebSentryRuntime,
  resetWebSentryRuntimeForTests,
  type WebSentrySdk,
} from "../src/observability/web-runtime-observability.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createSeededStore,
  readyClusterIdentity,
  requireMockCall,
} from "./note-browser-store-test-helpers.js";
import {
  loadTestRoute,
  selectTestNote,
  syncTestRoute,
} from "./note-browser-route-test-helpers.js";

afterEach(() => {
  resetWebSentryRuntimeForTests();
  vi.unstubAllGlobals();
});

describe("degraded browser correlation", () => {
  it("still completes note-list work when secure IDs are unavailable", async () => {
    const fake = installFakeRuntime();
    vi.stubGlobal("crypto", undefined);
    const listNotes = vi.fn<NoteBrowserApi["listNotes"]>(() =>
      Promise.resolve({ clusterIdentity: readyClusterIdentity, notes: [] }),
    );
    const store = createNoteBrowserStore({ api: createApi({ listNotes }) });

    await loadTestRoute(store, undefined, { replaceSelectedNote: vi.fn() });

    expect(requireMockCall(listNotes.mock.calls, 0)[0]).toEqual({});
    expect(eventCount(fake.info, events.correlationIdGenerationFailed)).toBe(1);
    expect(store.getState().notesState).toEqual({ data: [], status: "ready" });
  });
});

describe("note-list lifecycle evidence", () => {
  it("records joined start, success, and span evidence without an operation ID", async () => {
    const fake = installFakeRuntime();
    const listNotes = vi.fn<NoteBrowserApi["listNotes"]>(() =>
      Promise.resolve({ clusterIdentity: readyClusterIdentity, notes: [] }),
    );
    const store = createNoteBrowserStore({
      api: createApi({ listNotes }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });

    await loadTestRoute(store, undefined, { replaceSelectedNote: vi.fn() });

    const metadata = requireMockCall(listNotes.mock.calls, 0)[0];
    expect(requestIdSchema.safeParse(metadata.requestId).success).toBe(true);
    expect(metadata.noteOperationId).toBeUndefined();
    expect(eventAttributes(fake.info, events.notesListStarted)).toMatchObject({
      "azurite.request_id": metadata.requestId,
      "azurite.result_status": "started",
      "azurite.ui_request_sequence": 1,
    });
    expect(eventAttributes(fake.info, events.notesListSucceeded)).toMatchObject(
      {
        "azurite.cluster_id": readyClusterIdentity.clusterId,
        "azurite.note_count": 0,
        "azurite.request_id": metadata.requestId,
        "azurite.result_status": "succeeded",
      },
    );
    expect(fake.spanOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "notes.list",
        op: "azurite.note.operation",
      }),
    );
  });
});

describe("stale note-list lifecycle evidence", () => {
  it("retains the older request on a stale failed completion", async () => {
    const fake = installFakeRuntime();
    const first = createDeferred<ListNotesResponse>();
    const second = createDeferred<ListNotesResponse>();
    const listNotes = vi
      .fn<NoteBrowserApi["listNotes"]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = createNoteBrowserStore({
      api: createApi({ listNotes }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    const older = loadTestRoute(store, undefined, navigation);
    const newer = loadTestRoute(store, undefined, navigation);
    second.resolve({ clusterIdentity: readyClusterIdentity, notes: [] });
    await newer;
    first.reject(new Error("stale failure"));
    await older;

    const firstMetadata = requireMockCall(listNotes.mock.calls, 0)[0];
    expect(
      eventAttributes(fake.info, events.notesListStaleIgnored),
    ).toMatchObject({
      "azurite.request_id": firstMetadata.requestId,
      "azurite.result_status": "stale_ignored",
      "azurite.stale_completion": "failed",
      "azurite.ui_request_sequence": 1,
    });
  });

  it("records a stale successful completion without replacing newer failure", async () => {
    const fake = installFakeRuntime();
    const first = createDeferred<ListNotesResponse>();
    const second = createDeferred<ListNotesResponse>();
    const listNotes = vi
      .fn<NoteBrowserApi["listNotes"]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = createNoteBrowserStore({ api: createApi({ listNotes }) });
    const navigation = { replaceSelectedNote: vi.fn() };

    const older = loadTestRoute(store, undefined, navigation);
    const newer = loadTestRoute(store, undefined, navigation);
    second.reject(new Error("current failure"));
    await newer;
    first.resolve({ clusterIdentity: readyClusterIdentity, notes: [] });
    await older;

    expect(
      eventAttributes(fake.info, events.notesListStaleIgnored),
    ).toMatchObject({
      "azurite.result_status": "stale_ignored",
      "azurite.stale_completion": "succeeded",
      "azurite.ui_request_sequence": 1,
    });
    expect(store.getState().notesState).toMatchObject({ status: "error" });
  });
});

describe("startup note-load lifecycle evidence", () => {
  it("coalesces the URL echo into one startup operation and lifecycle", async () => {
    const fake = installFakeRuntime();
    const read = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() => read.promise);
    const store = createNoteBrowserStore({ api: createApi({ readNote }) });
    let routeEcho: Promise<void> | undefined;
    const navigation = {
      replaceSelectedNote: vi.fn((noteId: string) => {
        routeEcho = syncTestRoute(store, noteId);
      }),
    };

    const load = loadTestRoute(store, undefined, navigation);
    await vi.waitFor(() => {
      expect(readNote).toHaveBeenCalledOnce();
    });
    read.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Home", "sha256-home"),
    });
    await load;
    await routeEcho;

    expect(eventCount(fake.info, events.noteLoadStarted)).toBe(1);
    expect(eventCount(fake.info, events.noteLoadSucceeded)).toBe(1);
    expect(eventCount(fake.info, events.noteRouteSynchronized)).toBe(0);
    expect(
      eventAttributes(fake.info, events.noteRouteNavigationRequested),
    ).toMatchObject({
      "azurite.route_source": noteRouteSources.startupFallback,
    });
    expect(eventAttributes(fake.info, events.noteLoadStarted)).toMatchObject({
      "azurite.route_source": noteRouteSources.startupFallback,
    });
  });
});

describe("truthful note route-source evidence", () => {
  it("distinguishes note-list selection and URL synchronization", async () => {
    const fake = installFakeRuntime();
    const store = createSeededStore({ api: createApi() });

    await selectTestNote(store, "index.md");
    await syncTestRoute(store, "Projects/azurite.md");

    expect(
      eventAttributes(fake.info, events.noteRouteNavigationRequested),
    ).toMatchObject({ "azurite.route_source": noteRouteSources.noteList });
    expect(
      eventAttributes(fake.info, events.noteRouteSynchronized),
    ).toMatchObject({
      "azurite.route_source": noteRouteSources.urlSync,
    });
  });

  it("marks deliberate draft discard as a fresh reload source", async () => {
    const fake = installFakeRuntime();
    const store = createLoadedStore({ api: createApi() });

    await store.getState().discardDraftAndReloadDiskVersion();

    expect(eventAttributes(fake.info, events.noteLoadStarted)).toMatchObject({
      "azurite.route_source": noteRouteSources.draftDiscardReload,
    });
  });
});

describe("manual-save lifecycle evidence", () => {
  it("keeps one lifecycle and closure IDs while newer markdown stays dirty", async () => {
    const fake = installFakeRuntime();
    const deferred = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const saveNote = vi.fn<NoteBrowserApi["saveNote"]>(() => deferred.promise);
    const store = createLoadedStore({ api: createApi({ saveNote }) });
    store.getState().updateDraftMarkdown("# Saved snapshot");

    const first = store.getState().saveSelectedNote();
    store.getState().updateDraftMarkdown("# Newer markdown");
    const second = store.getState().saveSelectedNote();
    deferred.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Saved snapshot", "sha256-saved"),
    });
    await first;

    const metadata = requireMockCall(saveNote.mock.calls, 0)[1];
    expect(second).toBe(first);
    expect(eventCount(fake.info, events.noteSaveStarted)).toBe(1);
    expect(eventCount(fake.info, events.noteSaveSucceeded)).toBe(1);
    expect(eventAttributes(fake.info, events.noteSaveSucceeded)).toMatchObject({
      "azurite.content_hash": "sha256-saved",
      "azurite.note_operation_id": metadata.noteOperationId,
      "azurite.request_id": metadata.requestId,
      "azurite.result_status": "succeeded",
    });
    expect(store.getState().noteState).toMatchObject({
      editor: { currentMarkdown: "# Newer markdown" },
    });
  });

  it.each([
    [apiErrorCodes.noteWriteConflict, events.noteSaveConflicted, "conflicted"],
    [apiErrorCodes.noteWriteFailed, events.noteSaveFailed, "failed"],
  ] as const)(
    "maps %s onto exact semantic evidence",
    async (code, eventName, status) => {
      const fake = installFakeRuntime();
      const saveNote = vi.fn<NoteBrowserApi["saveNote"]>(() =>
        Promise.reject(
          new WebApiError("save failed", { code, failureKind: "api_response" }),
        ),
      );
      const store = createLoadedStore({ api: createApi({ saveNote }) });
      store.getState().updateDraftMarkdown("# Attempt");

      await store.getState().saveSelectedNote();

      const metadata = requireMockCall(saveNote.mock.calls, 0)[1];
      expect(eventAttributes(fake.info, eventName)).toMatchObject({
        "azurite.api_error_code": code,
        "azurite.note_operation_id": metadata.noteOperationId,
        "azurite.request_id": metadata.requestId,
        "azurite.result_status": status,
      });
      expect(fake.captureException).not.toHaveBeenCalled();
    },
  );
});

function installFakeRuntime() {
  const captureException = vi.fn(() => "event-id");
  const info = vi.fn();
  const spanOptions = vi.fn();
  const sdk: WebSentrySdk = {
    addBreadcrumb: vi.fn(),
    captureException,
    logger: { error: vi.fn(), info },
    startSpan<Result>(options: unknown, callback: () => Result): Result {
      spanOptions(options);
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
  return { captureException, info, spanOptions };
}

function eventAttributes(
  info: ReturnType<typeof vi.fn>,
  eventName: string,
): Record<string, unknown> {
  const call = info.mock.calls.find(([name]) => name === eventName);
  if (call === undefined) {
    throw new Error(`Expected ${eventName} evidence.`);
  }
  return call[1] as Record<string, unknown>;
}

function eventCount(info: ReturnType<typeof vi.fn>, eventName: string): number {
  return info.mock.calls.filter(([name]) => name === eventName).length;
}
