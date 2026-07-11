import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureWebRuntimeError,
  recordWebRuntimeEvent,
} from "../src/observability/web-runtime-observability.js";
import { createBrowserCorrelationId } from "../src/observability/browser-correlation.js";
import {
  correlationFailureReasons,
  correlationIdKinds,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
} from "@azurite/shared";

vi.mock("../src/observability/web-runtime-observability.js", () => ({
  captureWebRuntimeError: vi.fn(),
  recordWebRuntimeEvent: vi.fn(),
}));

const nativeId = "f1b24467-0b52-45e9-8e60-1d8d809a79dc";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("createBrowserCorrelationId", () => {
  it("uses a valid native UUID without touching the fallback", () => {
    const getRandomValues = vi.fn();
    vi.stubGlobal("crypto", {
      getRandomValues,
      randomUUID: vi.fn(() => nativeId),
    });

    expect(createBrowserCorrelationId(correlationIdKinds.request)).toBe(
      nativeId,
    );
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it.each(["invalid", "throws"])(
    "recovers a native %s through correctly formatted secure bytes",
    (nativeBehavior) => {
      vi.stubGlobal("crypto", {
        getRandomValues: (bytes: Uint8Array) => bytes,
        randomUUID:
          nativeBehavior === "throws"
            ? () => {
                throw new Error("native unavailable");
              }
            : () => "invalid",
      });

      expect(createBrowserCorrelationId(correlationIdKinds.noteOperation)).toBe(
        "00000000-0000-4000-8000-000000000000",
      );
      expect(recordWebRuntimeEvent).not.toHaveBeenCalled();
      expect(captureWebRuntimeError).not.toHaveBeenCalled();
    },
  );
});

describe("browser correlation failure evidence", () => {
  it("reports missing crypto once without weak randomness", () => {
    const weakRandom = vi.spyOn(Math, "random");
    vi.stubGlobal("crypto", undefined);

    expect(
      createBrowserCorrelationId(correlationIdKinds.request),
    ).toBeUndefined();
    expect(weakRandom).not.toHaveBeenCalled();
    expect(recordWebRuntimeEvent).toHaveBeenCalledOnce();
    expect(recordWebRuntimeEvent).toHaveBeenCalledWith({
      attributes: {
        [runtimeObservabilityAttributeNames.correlationFailureReason]:
          correlationFailureReasons.cryptoUnavailable,
        [runtimeObservabilityAttributeNames.correlationIdKind]:
          correlationIdKinds.request,
      },
      name: runtimeObservabilityEventNames.correlationIdGenerationFailed,
      surface: "web",
    });
  });

  it("classifies missing and throwing secure-byte fallbacks exactly", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "invalid" });
    expect(
      createBrowserCorrelationId(correlationIdKinds.noteOperation),
    ).toBeUndefined();
    expect(lastRecordedFailureReason()).toBe(
      correlationFailureReasons.randomValuesUnavailable,
    );

    const fallbackError = new Error("secure bytes failed");
    vi.stubGlobal("crypto", {
      getRandomValues: () => {
        throw fallbackError;
      },
      randomUUID: () => "invalid",
    });
    expect(
      createBrowserCorrelationId(correlationIdKinds.request),
    ).toBeUndefined();
    expect(lastCapturedError()).toBe(fallbackError);
    expect(lastCapturedFailureReason()).toBe(
      correlationFailureReasons.randomValuesFailed,
    );
  });
});

describe("browser correlation fallback validation", () => {
  it("rejects invalid fallback output without exposing the candidate", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: () => new Uint8Array(0),
      randomUUID: () => "invalid",
    });

    expect(
      createBrowserCorrelationId(correlationIdKinds.request),
    ).toBeUndefined();
    expect(recordWebRuntimeEvent).toHaveBeenCalledWith({
      attributes: {
        [runtimeObservabilityAttributeNames.correlationFailureReason]:
          correlationFailureReasons.uuidInvalid,
        [runtimeObservabilityAttributeNames.correlationIdKind]:
          correlationIdKinds.request,
      },
      name: runtimeObservabilityEventNames.correlationIdGenerationFailed,
      surface: "web",
    });
  });
});

function lastRecordedFailureReason(): unknown {
  const call = vi.mocked(recordWebRuntimeEvent).mock.calls.at(-1);
  return call?.[0].attributes?.[
    runtimeObservabilityAttributeNames.correlationFailureReason
  ];
}

function lastCapturedError(): unknown {
  return vi.mocked(captureWebRuntimeError).mock.calls.at(-1)?.[0];
}

function lastCapturedFailureReason(): unknown {
  const call = vi.mocked(captureWebRuntimeError).mock.calls.at(-1);
  if (call === undefined) {
    return undefined;
  }
  const attributes = call[1].attributes;
  if (attributes === undefined) {
    return undefined;
  }
  return attributes[
    runtimeObservabilityAttributeNames.correlationFailureReason
  ];
}
