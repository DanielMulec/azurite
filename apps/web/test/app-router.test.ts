// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AzuriteRouterProvider,
  parseAppLocationSearch,
  parseAppSearch,
} from "../src/app-router.js";

vi.mock("../src/App.js", () => ({ App: () => null }));

let activeWindowLedger:
  ReturnType<typeof trackWindowLifecycleResources> | undefined;

afterEach(() => {
  cleanup();
  activeWindowLedger?.forceCleanup();
  activeWindowLedger = undefined;
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("app router search parsing", () => {
  it("parses selected note search state from the URL", () => {
    expect(
      parseAppSearch({ note: "Phone QA/slice-5-conflict-test.md" }),
    ).toEqual({
      note: "Phone QA/slice-5-conflict-test.md",
    });
  });

  it("parses browser URL search through one decoding boundary", () => {
    expect(parseAppLocationSearch("?note=Phone%20QA%2Fslice.md")).toEqual({
      note: "Phone QA/slice.md",
    });
  });

  it("parses only the supported development diagnostics state", () => {
    expect(
      parseAppLocationSearch("?note=index.md&azurite-dev=sentry-test"),
    ).toEqual({
      "azurite-dev": "sentry-test",
      note: "index.md",
    });
    expect(
      parseAppLocationSearch("?note=index.md&azurite-dev=unsupported"),
    ).toEqual({ note: "index.md" });
  });

  it("preserves safe percent-containing note IDs", () => {
    expect(parseAppSearch({ note: "100%.md" })).toEqual({
      note: "100%.md",
    });
    expect(parseAppLocationSearch("?note=100%25.md")).toEqual({
      note: "100%.md",
    });
  });

  it("does not double-decode encoded-looking filenames", () => {
    expect(parseAppLocationSearch("?note=foo%252Fbar.md")).toEqual({
      note: "foo%2Fbar.md",
    });
  });

  it("drops non-string selected note search state", () => {
    expect(parseAppSearch({ note: 42 })).toEqual({});
    expect(parseAppSearch({})).toEqual({});
  });

  it.each(["", "../secret.md", "/tmp/secret.md", ".azurite/cache.md"])(
    "drops unsafe normalized selected note search state %s",
    (note) => {
      expect(parseAppSearch({ note })).toEqual({});
    },
  );

  it.each(["?note=..%2Fsecret.md", "?note=%2Ftmp%2Fsecret.md"])(
    "drops unsafe encoded browser location search %s",
    (note) => {
      expect(parseAppLocationSearch(note)).toEqual({});
    },
  );
});

describe("app router lifecycle ownership", () => {
  it.fails(
    "does not allocate browser resources during a render-only pass",
    () => {
      const ledger = startWindowLedger();

      renderToString(createElement(AzuriteRouterProvider));

      expect(ledger.snapshot()).toEqual(emptyWindowResourceCounts());
      expect(ledger.historyMethodsRestored()).toBe(true);
    },
  );

  it.fails(
    "keeps one StrictMode generation and releases it on final unmount",
    () => {
      const ledger = startWindowLedger();
      const view = render(
        createElement(
          StrictMode,
          undefined,
          createElement(AzuriteRouterProvider),
        ),
      );

      expect.soft(ledger.snapshot()).toEqual({
        beforeunload: { created: 2, destroyed: 1, live: 1 },
        popstate: { created: 4, destroyed: 2, live: 2 },
      });
      expect.soft(ledger.historyMethodsRestored()).toBe(false);

      view.unmount();

      expect.soft(ledger.snapshot()).toEqual({
        beforeunload: { created: 2, destroyed: 2, live: 0 },
        popstate: { created: 4, destroyed: 4, live: 0 },
      });
      expect(ledger.historyMethodsRestored()).toBe(true);
    },
  );
});

type TrackedWindowEvent = "beforeunload" | "popstate";

function startWindowLedger() {
  const ledger = trackWindowLifecycleResources();
  activeWindowLedger = ledger;
  return ledger;
}

function emptyWindowResourceCounts() {
  return {
    beforeunload: { created: 0, destroyed: 0, live: 0 },
    popstate: { created: 0, destroyed: 0, live: 0 },
  };
}

function trackWindowLifecycleResources() {
  const listenerSets = {
    beforeunload: new Set<EventListenerOrEventListenerObject>(),
    popstate: new Set<EventListenerOrEventListenerObject>(),
  };
  const created = { beforeunload: 0, popstate: 0 };
  const destroyed = { beforeunload: 0, popstate: 0 };
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;
  const originalPushState = Reflect.get(window.history, "pushState");
  const originalReplaceState = Reflect.get(window.history, "replaceState");
  const addSpy = vi
    .spyOn(window, "addEventListener")
    .mockImplementation((type, listener, options) => {
      if (isTrackedWindowEvent(type) && !listenerSets[type].has(listener)) {
        listenerSets[type].add(listener);
        created[type] += 1;
      }
      originalAddEventListener.call(window, type, listener, options);
    });
  const removeSpy = vi
    .spyOn(window, "removeEventListener")
    .mockImplementation((type, listener, options) => {
      if (isTrackedWindowEvent(type) && listenerSets[type].delete(listener)) {
        destroyed[type] += 1;
      }
      originalRemoveEventListener.call(window, type, listener, options);
    });

  return {
    forceCleanup: () => {
      addSpy.mockRestore();
      removeSpy.mockRestore();
      for (const [type, listeners] of Object.entries(listenerSets)) {
        for (const listener of listeners) {
          originalRemoveEventListener.call(window, type, listener);
        }
      }
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    },
    historyMethodsRestored: () =>
      window.history.pushState === originalPushState &&
      window.history.replaceState === originalReplaceState,
    snapshot: () => ({
      beforeunload: resourceCount(
        created.beforeunload,
        destroyed.beforeunload,
        listenerSets.beforeunload,
      ),
      popstate: resourceCount(
        created.popstate,
        destroyed.popstate,
        listenerSets.popstate,
      ),
    }),
  };
}

function isTrackedWindowEvent(type: string): type is TrackedWindowEvent {
  return type === "beforeunload" || type === "popstate";
}

function resourceCount(
  created: number,
  destroyed: number,
  listeners: ReadonlySet<EventListenerOrEventListenerObject>,
) {
  return { created, destroyed, live: listeners.size };
}
