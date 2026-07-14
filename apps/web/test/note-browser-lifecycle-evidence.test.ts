// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiErrorCodes,
  noteRouteSources,
  requestIdSchema,
  runtimeObservabilityEventNames as events,
} from "@azurite/shared";
import { WebApiError } from "../src/api-client.js";
import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import type { RouteTransitionOwner } from "../src/routing/route-transition-owner.js";
import {
  installWebSentryRuntime,
  resetWebSentryRuntimeForTests,
  type WebSentrySdk,
} from "../src/observability/web-runtime-observability.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import { useNoteBrowser } from "../src/use-note-browser.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createSeededStore,
  createTestDraft,
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StrictMode note-browser registrations", () => {
  it("balances replayed ownership and delivers each page event once", () => {
    const unregisterGate = vi.fn();
    const unregisterExecutor = vi.fn();
    const owner: RouteTransitionOwner = {
      dispose: vi.fn(),
      registerGate: vi.fn(() => unregisterGate),
      registerStoreExecutor: vi.fn(() => unregisterExecutor),
      selectNote: vi.fn(),
    };
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    const browser = renderHook(() => useNoteBrowser(owner), {
      reactStrictMode: true,
    });
    expect(owner.registerGate).toHaveBeenCalledTimes(2);
    expect(owner.registerStoreExecutor).toHaveBeenCalledTimes(2);
    expect(unregisterGate).toHaveBeenCalledOnce();
    expect(unregisterExecutor).toHaveBeenCalledOnce();
    expect(listenerCalls(addDocument, "visibilitychange")).toBe(2);
    expect(listenerCalls(removeDocument, "visibilitychange")).toBe(1);
    expect(listenerCalls(addWindow, "pagehide")).toBe(2);
    expect(listenerCalls(removeWindow, "pagehide")).toBe(1);
    expect(owner.selectNote).not.toHaveBeenCalled();

    const commitLifecycle = vi.spyOn(
      browser.result.current.editorSessionGate,
      "commitLifecycle",
    );
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    expect(commitLifecycle.mock.calls).toEqual([
      ["visibilitychange"],
      ["pagehide"],
    ]);

    const gate = browser.result.current.editorSessionGate;
    expectStrictSubscriptionBalanced(gate.subscribe, gate.getSnapshot);
    const store = createNoteBrowserStore({ api: createApi() });
    expectStrictSubscriptionBalanced(
      (listener) => store.subscribe(listener),
      () => store.getState().selectedNoteId,
    );

    browser.unmount();
    expect(unregisterGate).toHaveBeenCalledTimes(2);
    expect(unregisterExecutor).toHaveBeenCalledTimes(2);
    expect(listenerCalls(removeDocument, "visibilitychange")).toBe(2);
    expect(listenerCalls(removeWindow, "pagehide")).toBe(2);
    expect(commitLifecycle).toHaveBeenLastCalledWith("unmount");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("pagehide"));
    expect(commitLifecycle).toHaveBeenCalledTimes(3);
  });
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
  it("joins overlapping callers into one failed request lifecycle", async () => {
    const fake = installFakeRuntime();
    const response = createDeferred<ReturnType<NoteBrowserApi["listNotes"]>>();
    const listNotes = vi.fn<NoteBrowserApi["listNotes"]>(
      () => response.promise,
    );
    const store = createNoteBrowserStore({
      api: createApi({ listNotes }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });

    const first = store.getState().ensureNotes();
    const second = store.getState().ensureNotes();
    response.reject(new Error("current failure"));
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(listNotes).toHaveBeenCalledOnce();
    expect(eventCount(fake.info, events.notesListFailed)).toBe(1);
    expect(eventCount(fake.info, events.notesListStaleIgnored)).toBe(0);
  });

  it("joins overlapping callers into one successful request lifecycle", async () => {
    const fake = installFakeRuntime();
    const response = createDeferred<ReturnType<NoteBrowserApi["listNotes"]>>();
    const listNotes = vi.fn<NoteBrowserApi["listNotes"]>(
      () => response.promise,
    );
    const store = createNoteBrowserStore({ api: createApi({ listNotes }) });

    const first = store.getState().ensureNotes();
    const second = store.getState().ensureNotes();
    response.resolve({ clusterIdentity: readyClusterIdentity, notes: [] });
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(listNotes).toHaveBeenCalledOnce();
    expect(eventCount(fake.info, events.notesListSucceeded)).toBe(1);
    expect(eventCount(fake.info, events.notesListStaleIgnored)).toBe(0);
  });
});

describe("startup note-load lifecycle evidence", () => {
  it("coalesces the URL echo into one startup operation and lifecycle", async () => {
    const fake = installFakeRuntime();
    const read = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() => read.promise);
    const store = createNoteBrowserStore({ api: createApi({ readNote }) });
    const navigation = {
      replaceSelectedNote: vi.fn(),
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
    const drafts = createMemoryDraftPersistence([createTestDraft()]);
    const store = createLoadedStore({
      api: createApi(),
      draftPersistence: drafts.persistence,
      recovery: "draft",
    });

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

function listenerCalls(
  listener: {
    readonly mock: { readonly calls: readonly (readonly unknown[])[] };
  },
  eventName: string,
): number {
  return listener.mock.calls.filter(([name]) => name === eventName).length;
}

function expectStrictSubscriptionBalanced(
  subscribe: (listener: () => void) => () => void,
  getSnapshot: () => unknown,
): void {
  const countedSubscribe = vi.fn((listener: () => void) =>
    vi.fn(subscribe(listener)),
  );
  const subscriber = renderHook(
    () => useSyncExternalStore(countedSubscribe, getSnapshot, getSnapshot),
    { reactStrictMode: true },
  );
  expect(countedSubscribe).toHaveBeenCalledTimes(2);
  expect(countedSubscribe.mock.results[0]?.value).toHaveBeenCalledOnce();
  subscriber.unmount();
  expect(countedSubscribe.mock.results[1]?.value).toHaveBeenCalledOnce();
}
