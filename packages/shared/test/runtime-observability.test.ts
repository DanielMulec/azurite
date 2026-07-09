import { describe, expect, expectTypeOf, it } from "vitest";

import {
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  type RuntimeObservabilityEvent,
} from "../src/index.js";

describe("runtime observability contract", () => {
  it("exports the stable Slice 7A event vocabulary", () => {
    expect(runtimeObservabilityEventNames).toEqual({
      consoleCaptured: "telemetry.runtime.console.captured",
      serverTestTriggered: "telemetry.server.test.triggered",
      shutdownFailed: "telemetry.runtime.shutdown.failed",
      shutdownFlushed: "telemetry.runtime.shutdown.flushed",
      shutdownStarted: "telemetry.runtime.shutdown.started",
      traceHeadersSeen: "telemetry.runtime.trace_headers.seen",
      webTestTriggered: "telemetry.web.test.triggered",
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
      surface: "server",
    } satisfies RuntimeObservabilityEvent;

    expectTypeOf(fakeCorrelatedNoteEvent).toExtend<RuntimeObservabilityEvent>();
    expect(fakeCorrelatedNoteEvent.attributes["azurite.request_id"]).toBe(
      "request-7b",
    );
  });
});
