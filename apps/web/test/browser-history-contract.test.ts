// @vitest-environment jsdom

import { createBrowserHistory, type RouterHistory } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

type TestHistoryState = {
  readonly __TSR_index: number;
  readonly __TSR_key: string;
  readonly key: string;
};

type TestHistoryEntry = {
  readonly href: string;
  readonly state: TestHistoryState;
};

describe("installed TanStack browser-history contract", () => {
  it("admits push and replace only after their blocker continues", async () => {
    const browser = createTestBrowser(["/?note=a.md"]);
    const history = createBrowserHistory({ window: browser.window });
    let shouldBlock = true;
    history.block({
      blockerFn: () => shouldBlock,
      enableBeforeUnload: false,
    });

    history.push("/?note=b.md");
    await vi.waitFor(() => {
      expect(browser.currentHref()).toBe("/?note=a.md");
    });
    expect(browser.entries()).toHaveLength(1);

    history.replace("/?note=blocked.md");
    await vi.waitFor(() => {
      expect(browser.currentHref()).toBe("/?note=a.md");
    });
    expect(browser.entries()).toHaveLength(1);

    shouldBlock = false;
    history.push("/?note=b.md");
    await expectCurrent(browser, "/?note=b.md");
    history.replace("/?note=c.md");
    await expectCurrent(browser, "/?note=c.md");
    expect(browser.entries()).toHaveLength(2);
  });

  it.each([
    { delta: -1, name: "Back" },
    { delta: 1, name: "Forward" },
    { delta: -2, name: "multi-entry Go" },
  ])(
    "restores the exact predecessor after cancelled $name",
    async ({ delta }) => {
      const initialIndex = delta === 1 ? 2 : 3;
      const browser = createTestBrowser(
        ["/?note=a.md", "/?note=b.md", "/?note=c.md", "/?note=d.md"],
        initialIndex,
      );
      const initialEntries = browser.entries();
      const predecessor = initialEntries[initialIndex];
      if (predecessor === undefined) {
        throw new Error("Expected a predecessor entry.");
      }
      const history = createBrowserHistory({ window: browser.window });
      let shouldBlock = true;
      history.block({
        blockerFn: () => shouldBlock,
        enableBeforeUnload: false,
      });

      navigateByDelta(history, delta);
      await expectCurrent(browser, predecessor.href);

      expect(browser.entries()).toEqual(initialEntries);
      expect(browser.currentState()).toEqual(predecessor.state);

      shouldBlock = false;
      navigateByDelta(history, delta);
      const retriedEntry = initialEntries[initialIndex + delta];
      if (retriedEntry === undefined) {
        throw new Error("Expected a retry destination entry.");
      }
      await expectCurrent(browser, retriedEntry.href);
      expect(browser.entries()).toEqual(initialEntries);
    },
  );

  it("keeps every entry reachable after cancelled traversal", async () => {
    const browser = createTestBrowser([
      "/?note=a.md",
      "/?note=b.md",
      "/?note=c.md",
    ]);
    const history = createBrowserHistory({ window: browser.window });
    let shouldBlock = true;
    history.block({
      blockerFn: () => shouldBlock,
      enableBeforeUnload: false,
    });

    history.back();
    await expectCurrent(browser, "/?note=c.md");
    shouldBlock = false;
    history.back();
    await expectCurrent(browser, "/?note=b.md");
    history.back();
    await expectCurrent(browser, "/?note=a.md");
    history.forward();
    await expectCurrent(browser, "/?note=b.md");
    history.forward();
    await expectCurrent(browser, "/?note=c.md");
  });
});

function navigateByDelta(history: RouterHistory, delta: number): void {
  if (delta === -1) {
    history.back();
    return;
  }
  if (delta === 1) {
    history.forward();
    return;
  }
  history.go(delta);
}

async function expectCurrent(
  browser: TestBrowser,
  expectedHref: string,
): Promise<void> {
  await vi.waitFor(() => {
    expect(browser.currentHref()).toBe(expectedHref);
  });
}

type BrowserEventListener = () => void | Promise<void>;

type TestBrowser = {
  readonly currentHref: () => string;
  readonly currentState: () => TestHistoryState;
  readonly entries: () => readonly TestHistoryEntry[];
  readonly window: object;
};

function createTestBrowser(
  hrefs: readonly string[],
  initialIndex = hrefs.length - 1,
): TestBrowser {
  let entries = hrefs.map(createHistoryEntry);
  let index = initialIndex;
  const listeners = new Map<string, Set<BrowserEventListener>>();
  const location = createTestLocation(() => entries[index]?.href ?? "/");
  const history = {
    back: () => {
      move(-1);
    },
    forward: () => {
      move(1);
    },
    get length() {
      return entries.length;
    },
    go: (delta: number) => {
      move(delta);
    },
    pushState: (state: TestHistoryState, _unused: string, href: string) => {
      entries = [
        ...entries.slice(0, index + 1),
        { href, state: structuredClone(state) },
      ];
      index = entries.length - 1;
    },
    replaceState: (state: TestHistoryState, _unused: string, href?: string) => {
      const current = requireEntry(entries, index);
      entries = entries.with(index, {
        href: href ?? current.href,
        state: structuredClone(state),
      });
    },
    get state() {
      return requireEntry(entries, index).state;
    },
  };

  function move(delta: number): void {
    const nextIndex = Math.min(Math.max(index + delta, 0), entries.length - 1);
    if (nextIndex === index) {
      return;
    }
    index = nextIndex;
    queueMicrotask(() => {
      dispatch("popstate", listeners);
    });
  }

  return {
    currentHref: () => requireEntry(entries, index).href,
    currentState: () => structuredClone(requireEntry(entries, index).state),
    entries: () => structuredClone(entries),
    window: {
      addEventListener: (type: string, listener: BrowserEventListener) => {
        const eventListeners = listeners.get(type) ?? new Set();
        eventListeners.add(listener);
        listeners.set(type, eventListeners);
      },
      history,
      location,
      removeEventListener: (type: string, listener: BrowserEventListener) => {
        listeners.get(type)?.delete(listener);
      },
    },
  };
}

function createHistoryEntry(href: string, index: number): TestHistoryEntry {
  const key = `history-${String(index)}`;
  return { href, state: { __TSR_index: index, __TSR_key: key, key } };
}

function requireEntry(
  entries: readonly TestHistoryEntry[],
  index: number,
): TestHistoryEntry {
  const entry = entries[index];
  if (entry === undefined) {
    throw new Error(`Missing test history entry ${String(index)}.`);
  }
  return entry;
}

function createTestLocation(readHref: () => string): object {
  return {
    get hash() {
      return new URL(readHref(), "http://azurite.test").hash;
    },
    get pathname() {
      return new URL(readHref(), "http://azurite.test").pathname;
    },
    get search() {
      return new URL(readHref(), "http://azurite.test").search;
    },
  };
}

function dispatch(
  type: string,
  listeners: ReadonlyMap<string, ReadonlySet<BrowserEventListener>>,
): void {
  for (const listener of listeners.get(type) ?? []) {
    void listener();
  }
}
