import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  noteRouteSources,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  runtimeResultStatuses,
  runFailOpenRuntimeSpan,
  runtimeSpanNames,
  runtimeSpanOperations,
  staleCompletionStatuses,
  type RuntimeObservabilityEvent,
} from "../src/index.js";

describe("runtime observability contract", () => {
  it("exports the exact Slice 7A and 7B event vocabulary", () => {
    expect(runtimeObservabilityEventNames).toEqual({
      apiRequestFailed: "api.request.failed",
      apiRequestStarted: "api.request.started",
      apiRequestSucceeded: "api.request.succeeded",
      consoleCaptured: "telemetry.runtime.console.captured",
      correlationIdGenerationFailed: "correlation.id_generation.failed",
      noteLoadFailed: "note.load.failed",
      noteLoadStaleIgnored: "note.load.stale_ignored",
      noteLoadStarted: "note.load.started",
      noteLoadSucceeded: "note.load.succeeded",
      noteReadFailed: "note.read.failed",
      noteReadInvalid: "note.read.invalid",
      noteReadNotFound: "note.read.not_found",
      noteReadStarted: "note.read.started",
      noteReadSucceeded: "note.read.succeeded",
      noteRouteNavigationRequested: "note.route.navigation_requested",
      noteRouteSynchronized: "note.route.synchronized",
      noteSaveConflicted: "note.save.conflicted",
      noteSaveFailed: "note.save.failed",
      noteSaveInvalid: "note.save.invalid",
      noteSaveNotFound: "note.save.not_found",
      noteSaveStarted: "note.save.started",
      noteSaveSucceeded: "note.save.succeeded",
      notesListFailed: "notes.list.failed",
      notesListStaleIgnored: "notes.list.stale_ignored",
      notesListStarted: "notes.list.started",
      notesListSucceeded: "notes.list.succeeded",
      serverTestTriggered: "telemetry.server.test.triggered",
      shutdownFailed: "telemetry.runtime.shutdown.failed",
      shutdownFlushed: "telemetry.runtime.shutdown.flushed",
      shutdownStarted: "telemetry.runtime.shutdown.started",
      traceHeadersSeen: "telemetry.runtime.trace_headers.seen",
      webTestTriggered: "telemetry.web.test.triggered",
    });
    expect(runtimeResultStatuses).toEqual({
      conflicted: "conflicted",
      failed: "failed",
      invalid: "invalid",
      notFound: "not_found",
      staleIgnored: "stale_ignored",
      started: "started",
      succeeded: "succeeded",
    });
    expect(noteRouteSources).toEqual({
      draftDiscardReload: "draft_discard_reload",
      noteList: "note_list",
      startupFallback: "startup_fallback",
      urlSync: "url_sync",
    });
    expect(staleCompletionStatuses).toEqual({
      failed: "failed",
      succeeded: "succeeded",
    });
    expect(runtimeSpanNames).toEqual({
      apiRequest: "api.request",
      noteLoad: "note.load",
      noteRead: "note.read",
      noteSave: "note.save",
      notesList: "notes.list",
    });
    expect(runtimeSpanOperations).toEqual({
      apiRequest: "azurite.api.request",
      noteOperation: "azurite.note.operation",
      runtime: "azurite.runtime",
      serverRoute: "azurite.server.route",
    });
  });

  it("accepts a fake Slice 7B event without a Sentry import or shape fork", () => {
    const fakeCorrelatedNoteEvent = {
      attributes: {
        "azurite.note_id": "Projects/azurite.md",
        "azurite.note_operation_id": "operation-7b",
        "azurite.request_id": "request-7b",
        [runtimeObservabilityAttributeNames.resultStatus]: "succeeded",
      },
      name: "note.read.succeeded",
      spanName: "note.read",
      spanOperation: "azurite.server.route",
      surface: "server",
      tags: { "azurite.request_id": "request-7b" },
    } satisfies RuntimeObservabilityEvent;

    expectTypeOf(fakeCorrelatedNoteEvent).toExtend<RuntimeObservabilityEvent>();
    expect(fakeCorrelatedNoteEvent.attributes["azurite.request_id"]).toBe(
      "request-7b",
    );
  });
});

describe("fail-open runtime span execution", () => {
  it("falls back exactly once when setup throws before invoking work", () => {
    const callback = vi.fn(() => "completed");

    expect(
      runFailOpenRuntimeSpan(() => {
        throw new Error("SDK setup failed");
      }, callback),
    ).toBe("completed");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("preserves a result when the SDK throws after invoking work", () => {
    const callback = vi.fn(() => 42);

    expect(
      runFailOpenRuntimeSpan((guarded) => {
        guarded();
        throw new Error("SDK completion failed");
      }, callback),
    ).toBe(42);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs work when an SDK returns without invoking it", () => {
    const callback = vi.fn(() => "fallback");

    expect(runFailOpenRuntimeSpan(() => undefined, callback)).toBe("fallback");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("preserves the original product throw", () => {
    const error = new Error("product failure");
    const callback = vi.fn(() => {
      throw error;
    });

    expect(() =>
      runFailOpenRuntimeSpan((guarded) => {
        try {
          guarded();
        } catch {
          // A hostile SDK may swallow the product error.
        }
      }, callback),
    ).toThrow(error);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("returns the exact asynchronously rejected product promise", async () => {
    const error = new Error("async product failure");
    let rejectProduct!: (reason: unknown) => void;
    const productPromise = new Promise<never>((_resolve, reject) => {
      rejectProduct = reject;
    });
    const callback = vi.fn(() => productPromise);
    const result = runFailOpenRuntimeSpan((guarded) => {
      void guarded();
    }, callback);

    expect(result).toBe(productPromise);
    const rejection = expect(result).rejects.toBe(error);
    rejectProduct(error);
    await rejection;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not rerun work when the SDK invokes its callback late", () => {
    let lateCallback: (() => string) | undefined;
    const product = vi.fn(() => "once");
    const result = runFailOpenRuntimeSpan((guarded) => {
      lateCallback = guarded;
    }, product);

    expect(result).toBe("once");
    expect(lateCallback?.()).toBe("once");
    expect(product).toHaveBeenCalledTimes(1);
  });
});
