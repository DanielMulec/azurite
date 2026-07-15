import { describe, expect, it, vi } from "vitest";

import {
  captureFailOpenRuntimeError,
  recordFailOpenRuntimeEvent,
  runFailOpenRuntimeCarrierSpan,
  type FailOpenRuntimeCarrier,
  type RuntimeObservabilityCarrierCallbacks,
  type RuntimeObservabilityScopeCarrier,
} from "../src/index.js";

const environment = "carrier-test";
const release = "azurite-carrier-test";

describe("fail-open runtime record carrier", () => {
  it("delivers one scoped log and breadcrumb with exact attributes", () => {
    const fake = createFakeCarrier();
    const event = {
      attributes: {
        boolean: true,
        nullish: null,
        numeric: 7,
        text: "value",
        undefined: undefined,
      },
      name: "carrier.record",
      surface: "web",
      tags: { "azurite.request_id": "request-id" },
    } as const;
    const attributes = {
      "app.surface": "web",
      boolean: true,
      nullish: null,
      numeric: 7,
      "sentry.environment": environment,
      "sentry.release": release,
      text: "value",
    };

    recordFailOpenRuntimeEvent(fake.carrier, event);

    expect(fake.info).toHaveBeenCalledOnce();
    expect(fake.info).toHaveBeenCalledWith(event.name, attributes, {
      scope: fake.scope,
    });
    expect(fake.addBreadcrumb).toHaveBeenCalledOnce();
    expect(fake.addBreadcrumb).toHaveBeenCalledWith({
      category: "azurite.runtime",
      data: attributes,
      level: "info",
      message: event.name,
    });
    expect(fake.setTag).toHaveBeenNthCalledWith(1, "app.surface", "web");
    expect(fake.setTag).toHaveBeenNthCalledWith(
      2,
      "azurite.request_id",
      "request-id",
    );
    expect(fake.setContext).toHaveBeenCalledWith("azurite.runtime", attributes);
  });
});

describe("fail-open runtime capture carrier", () => {
  it("delivers the original error once with normalized code and stack", () => {
    for (const [code, normalizedCode] of [
      ["E_STRING", "E_STRING"],
      [42, "42"],
    ] as const) {
      const fake = createFakeCarrier();
      const error = Object.assign(new Error("deliberate"), { code });
      error.name = "CarrierError";
      error.stack = "CarrierError: deliberate\n at carrier-test";
      const event = { name: "carrier.capture", surface: "server" } as const;

      captureFailOpenRuntimeError(fake.carrier, error, event);

      expect(fake.error).toHaveBeenCalledOnce();
      expect(fake.captureException).toHaveBeenCalledOnce();
      expect(fake.captureException).toHaveBeenCalledWith(error);
      expect(fake.setContext).toHaveBeenCalledWith("azurite.error", {
        code: normalizedCode,
        message: "deliberate",
        name: "CarrierError",
        stack: "CarrierError: deliberate\n at carrier-test",
      });
    }
  });

  it("normalizes non-Errors and omits unsupported code and absent stack", () => {
    const nonErrorFake = createFakeCarrier();
    const nonError = { reason: "plain object" };

    captureFailOpenRuntimeError(nonErrorFake.carrier, nonError, {
      name: "carrier.non_error",
      surface: "web",
    });

    expect(nonErrorFake.captureException).toHaveBeenCalledWith(nonError);
    expect(nonErrorFake.setContext).toHaveBeenCalledWith("azurite.error", {
      message: "A non-Error value was thrown.",
      name: "UnknownError",
    });

    const errorFake = createFakeCarrier();
    const error = Object.assign(new Error("without detail"), { code: true });
    delete error.stack;
    captureFailOpenRuntimeError(errorFake.carrier, error, {
      name: "carrier.error",
      surface: "web",
    });
    expect(errorFake.setContext).toHaveBeenCalledWith("azurite.error", {
      message: "without detail",
      name: "Error",
    });
  });
});

describe("fail-open runtime scope fallback", () => {
  it("uses exact unscoped output when scope setup fails before callback", () => {
    const fake = createFakeCarrier();
    fake.callbacks.withScope = () => {
      throw new Error("scope failed before callback");
    };
    const event = { name: "carrier.fallback", surface: "server" } as const;
    const error = new Error("product error");
    const attributes = {
      "app.surface": "server",
      "sentry.environment": environment,
      "sentry.release": release,
    };

    recordFailOpenRuntimeEvent(fake.carrier, event);
    captureFailOpenRuntimeError(fake.carrier, error, event);

    expect(fake.info).toHaveBeenCalledOnce();
    expect(fake.info).toHaveBeenCalledWith(event.name, attributes);
    expect(fake.error).toHaveBeenCalledOnce();
    expect(fake.error).toHaveBeenCalledWith(event.name, attributes);
    expect(fake.addBreadcrumb).toHaveBeenCalledOnce();
    expect(fake.captureException).toHaveBeenCalledOnce();
    expect(fake.captureException).toHaveBeenCalledWith(error);
  });

  it("does not repeat scoped output when the scope fails after callback", () => {
    const fake = createFakeCarrier();
    fake.callbacks.withScope = (callback) => {
      callback(fake.scope);
      throw new Error("scope failed after callback");
    };
    const event = { name: "carrier.scoped_once", surface: "web" } as const;

    recordFailOpenRuntimeEvent(fake.carrier, event);
    captureFailOpenRuntimeError(fake.carrier, new Error("product"), event);

    expect(fake.info).toHaveBeenCalledOnce();
    expect(fake.info.mock.calls[0]).toHaveLength(3);
    expect(fake.error).toHaveBeenCalledOnce();
    expect(fake.error.mock.calls[0]).toHaveLength(3);
    expect(fake.addBreadcrumb).toHaveBeenCalledOnce();
    expect(fake.captureException).toHaveBeenCalledOnce();
  });
});

describe("fail-open runtime callback isolation", () => {
  it("continues independent deliveries through throwing carrier callbacks", () => {
    const fake = createFakeCarrier();
    const setContext = vi.fn(() => {
      throw new Error("context failed");
    });
    const setTag = vi.fn(() => {
      throw new Error("tag failed");
    });
    fake.callbacks.withScope = (callback) => {
      callback({ setContext, setTag });
    };
    const info = vi.fn(() => {
      throw new Error("info failed");
    });
    const addBreadcrumb = vi.fn(() => {
      throw new Error("breadcrumb failed");
    });
    const error = vi.fn(() => {
      throw new Error("error failed");
    });
    const captureException = vi.fn(() => {
      throw new Error("capture failed");
    });
    fake.callbacks.logger.info = info;
    fake.callbacks.addBreadcrumb = addBreadcrumb;
    fake.callbacks.logger.error = error;
    fake.callbacks.captureException = captureException;
    const event = {
      name: "carrier.failure",
      surface: "server",
      tags: { "azurite.request_id": "request" },
    } as const;

    expect(() => {
      recordFailOpenRuntimeEvent(fake.carrier, event);
      captureFailOpenRuntimeError(fake.carrier, new Error("product"), event);
    }).not.toThrow();
    expect(setTag).toHaveBeenCalledTimes(4);
    expect(setContext).toHaveBeenCalledTimes(3);
    expect(info).toHaveBeenCalledOnce();
    expect(addBreadcrumb).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(captureException).toHaveBeenCalledOnce();
  });
});

describe("fail-open runtime span carrier", () => {
  it("filters span attributes and selects explicit and default span metadata", () => {
    const fake = createFakeCarrier();
    const explicitCallback = vi.fn(() => ({ result: "identity" }));
    const explicitResult = runFailOpenRuntimeCarrierSpan(
      fake.carrier,
      {
        attributes: { nullish: null, present: "value", undefined: undefined },
        name: "carrier.span.explicit",
        spanName: "note.save",
        spanOperation: "azurite.note.operation",
        surface: "web",
      },
      explicitCallback,
    );
    const defaultCallback = vi.fn(() => "default");

    expect(
      runFailOpenRuntimeCarrierSpan(
        fake.carrier,
        { name: "carrier.span.default", surface: "server" },
        defaultCallback,
      ),
    ).toBe("default");
    expect(explicitResult).toBe(explicitCallback.mock.results[0]?.value);
    expect(explicitCallback).toHaveBeenCalledOnce();
    expect(defaultCallback).toHaveBeenCalledOnce();
    expect(fake.startSpan).toHaveBeenNthCalledWith(1, {
      attributes: {
        "app.surface": "web",
        present: "value",
        "sentry.environment": environment,
        "sentry.release": release,
      },
      name: "note.save",
      op: "azurite.note.operation",
    });
    expect(fake.startSpan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "carrier.span.default",
        op: "azurite.runtime",
      }),
    );
  });

  it("selects direct work when disabled and fail-open work when enabled", () => {
    const disabledCallback = vi.fn(() => "disabled");
    expect(
      runFailOpenRuntimeCarrierSpan(
        undefined,
        { name: "carrier.disabled", surface: "web" },
        disabledCallback,
      ),
    ).toBe("disabled");
    expect(disabledCallback).toHaveBeenCalledOnce();

    const fake = createFakeCarrier();
    fake.callbacks.startSpan = () => {
      throw new Error("span setup failed");
    };
    const enabledCallback = vi.fn(() => "enabled fallback");
    expect(
      runFailOpenRuntimeCarrierSpan(
        fake.carrier,
        { name: "carrier.enabled", surface: "server" },
        enabledCallback,
      ),
    ).toBe("enabled fallback");
    expect(enabledCallback).toHaveBeenCalledOnce();
  });
});

function createFakeCarrier() {
  const addBreadcrumb = vi.fn();
  const captureException = vi.fn(() => "event-id");
  const error = vi.fn();
  const info = vi.fn();
  const startSpan = vi.fn();
  const setContext = vi.fn();
  const setTag = vi.fn();
  const scope: RuntimeObservabilityScopeCarrier = { setContext, setTag };
  const callbacks: RuntimeObservabilityCarrierCallbacks = {
    addBreadcrumb,
    captureException,
    logger: { error, info },
    startSpan<Result>(options: unknown, callback: () => Result): Result {
      startSpan(options);
      return callback();
    },
    withScope(callback) {
      callback(scope);
    },
  };
  const carrier: FailOpenRuntimeCarrier = {
    callbacks,
    environment,
    release,
  };

  return {
    addBreadcrumb,
    callbacks,
    captureException,
    carrier,
    error,
    info,
    scope,
    setContext,
    setTag,
    startSpan,
  };
}
