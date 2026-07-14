import type {
  BlockerFn,
  HistoryLocation,
  RouterHistory,
} from "@tanstack/react-router";

import {
  createRouteTransitionOwner,
  type RouteTransitionOwner,
} from "../src/routing/route-transition-owner.js";
import type { RouteTransitionRouterAdapter } from "../src/routing/route-transition-runtime.js";
import { applicationNavigationTokenStateKey } from "../src/routing/validated-route-location.js";

type NavigationMode =
  | "normal"
  | "reject_after_echo"
  | "reject_before_echo"
  | "resolve_before_router"
  | "throw_sync";

type HarnessRuntime = {
  browserIndex: number;
  readonly entries: HistoryLocation[];
  readonly historyListeners: Set<(location: HistoryLocation) => void>;
  keySequence: number;
  mode: NavigationMode;
  readonly navigations: Array<{
    readonly href: string;
    readonly replace: boolean;
    readonly token: string;
  }>;
  readonly popListeners: Set<() => void>;
  readonly resolvedListeners: Set<(location: HistoryLocation) => void>;
  routerIndex: number;
  blocker: BlockerFn | undefined;
  heldResolvedLocation: HistoryLocation | undefined;
};

/** Deterministic browser/router boundary used by route-owner contract tests. */
export type RouteOwnerHarness = {
  readonly blockerCount: () => number;
  readonly current: () => HistoryLocation;
  readonly entries: () => readonly HistoryLocation[];
  readonly historySubscriptionCount: () => number;
  readonly navigateCount: () => number;
  readonly navigations: () => readonly HarnessRuntime["navigations"][number][];
  readonly owner: RouteTransitionOwner;
  readonly popStateSubscriptionCount: () => number;
  readonly resolveCurrent: () => void;
  readonly resolveHeldNavigation: () => void;
  readonly resolvedSubscriptionCount: () => number;
  readonly setNavigationMode: (mode: NavigationMode) => void;
  readonly traverse: (delta: number) => Promise<void>;
};

/** Creates a controlled owner with exact history and restoration identities. */
export function createRouteOwnerHarness(
  input: {
    readonly confirmRestoration?: (
      expected: BrowserIdentity,
      actual: BrowserIdentity,
    ) => boolean;
    readonly entries?: readonly string[];
    readonly initialIndex?: number;
  } = {},
): RouteOwnerHarness {
  const runtime = createHarnessRuntime(
    getHarnessEntries(input.entries),
    input.initialIndex,
  );
  const history = createHistoryBoundary(runtime);
  const router = createRouterBoundary(runtime);
  const owner = createRouteTransitionOwner({
    ...getRestorationControl(input.confirmRestoration),
    history,
    readBrowserLocation: () => locationIdentity(readBrowserLocation(runtime)),
    router,
    subscribeToPopState: (listener) =>
      subscribe(runtime.popListeners, listener),
  });
  return createHarnessApi(owner, runtime);
}

function getHarnessEntries(
  entries: readonly string[] | undefined,
): readonly string[] {
  return entries ?? ["/?note=a.md"];
}

function getRestorationControl(
  confirmRestoration:
    | ((expected: BrowserIdentity, actual: BrowserIdentity) => boolean)
    | undefined,
): { readonly confirmRestoration?: typeof confirmRestoration } {
  return confirmRestoration === undefined ? {} : { confirmRestoration };
}

/** Creates a promise whose settlement is controlled by a test. */
export function createDeferred<Result>(): {
  readonly promise: Promise<Result>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (result: Result) => void;
} {
  let rejectResult: (error: unknown) => void = () => {};
  let resolveResult: (result: Result) => void = () => {};
  const promise = new Promise<Result>((resolve, reject) => {
    rejectResult = reject;
    resolveResult = resolve;
  });
  return { promise, reject: rejectResult, resolve: resolveResult };
}

type BrowserIdentity = {
  readonly historyIndex: number | undefined;
  readonly historyKey: string | undefined;
  readonly href: string;
};

function createHarnessRuntime(
  hrefs: readonly string[],
  initialIndex: number | undefined,
): HarnessRuntime {
  const entries = hrefs.map((href, index) => createLocation({ href, index }));
  const selectedIndex = initialIndex ?? entries.length - 1;
  return {
    blocker: undefined,
    browserIndex: selectedIndex,
    entries,
    heldResolvedLocation: undefined,
    historyListeners: new Set(),
    keySequence: entries.length,
    mode: "normal",
    navigations: [],
    popListeners: new Set(),
    resolvedListeners: new Set(),
    routerIndex: selectedIndex,
  };
}

function createHistoryBoundary(runtime: HarnessRuntime): RouterHistory {
  const boundary = {
    block: (input: Parameters<RouterHistory["block"]>[0]) => {
      runtime.blocker = input.blockerFn;
      return () => {
        if (runtime.blocker === input.blockerFn) {
          runtime.blocker = undefined;
        }
      };
    },
  };
  return boundary as RouterHistory;
}

function createRouterBoundary(
  runtime: HarnessRuntime,
): RouteTransitionRouterAdapter {
  return {
    historyLocation: () => readRouterLocation(runtime),
    navigate: (input) => startHarnessNavigation(input, runtime),
    subscribeHistory: (listener) =>
      subscribe(runtime.historyListeners, listener),
    subscribeResolved: (listener) =>
      subscribe(runtime.resolvedListeners, listener),
  };
}

function startHarnessNavigation(
  input: HarnessRuntime["navigations"][number],
  runtime: HarnessRuntime,
): Promise<void> {
  if (runtime.mode === "throw_sync") {
    throw new Error("Injected synchronous navigation failure.");
  }
  return navigateApplication(input, runtime);
}

async function navigateApplication(
  input: HarnessRuntime["navigations"][number],
  runtime: HarnessRuntime,
): Promise<void> {
  runtime.navigations.push(input);
  if (runtime.mode === "reject_before_echo") {
    throw new Error("Injected navigation rejection before history echo.");
  }
  const current = readRouterLocation(runtime);
  const next = createApplicationLocation(input, runtime);
  const blocked = await callBlocker(runtime, {
    action: applicationAction(input.replace),
    currentLocation: current,
    nextLocation: next,
  });
  if (blocked) {
    return;
  }
  commitApplicationLocation(next, input.replace, runtime);
  emit(runtime.historyListeners, next);
  completeApplicationNavigation(next, runtime);
}

function completeApplicationNavigation(
  next: HistoryLocation,
  runtime: HarnessRuntime,
): void {
  if (runtime.mode === "reject_after_echo") {
    throw new Error("Injected navigation rejection after history echo.");
  }
  if (runtime.mode === "resolve_before_router") {
    runtime.heldResolvedLocation = next;
    return;
  }
  emit(runtime.resolvedListeners, next);
}

function applicationAction(replace: boolean): "PUSH" | "REPLACE" {
  return replace ? "REPLACE" : "PUSH";
}

function createApplicationLocation(
  input: HarnessRuntime["navigations"][number],
  runtime: HarnessRuntime,
): HistoryLocation {
  runtime.keySequence += 1;
  const index = input.replace ? runtime.routerIndex : runtime.routerIndex + 1;
  return createLocation({
    href: input.href,
    index,
    key: `history-${String(runtime.keySequence)}`,
    token: input.token,
  });
}

function commitApplicationLocation(
  location: HistoryLocation,
  replace: boolean,
  runtime: HarnessRuntime,
): void {
  if (replace) {
    runtime.entries[runtime.routerIndex] = location;
  } else {
    runtime.entries.splice(runtime.routerIndex + 1, Infinity, location);
    runtime.routerIndex += 1;
  }
  runtime.browserIndex = runtime.routerIndex;
}

async function traverseHistory(
  delta: number,
  runtime: HarnessRuntime,
): Promise<void> {
  const nextIndex = runtime.routerIndex + delta;
  const next = requireLocation(runtime.entries, nextIndex);
  const current = readRouterLocation(runtime);
  runtime.browserIndex = nextIndex;
  const blocked = await callBlocker(runtime, {
    action: traversalAction(delta),
    currentLocation: current,
    nextLocation: next,
  });
  if (blocked) {
    runtime.browserIndex = runtime.routerIndex;
    emit(runtime.popListeners, undefined);
    await Promise.resolve();
    return;
  }
  runtime.routerIndex = nextIndex;
  emit(runtime.historyListeners, next);
  emit(runtime.resolvedListeners, next);
}

function createHarnessApi(
  owner: RouteTransitionOwner,
  runtime: HarnessRuntime,
): RouteOwnerHarness {
  return {
    blockerCount: () => (runtime.blocker === undefined ? 0 : 1),
    current: () => readRouterLocation(runtime),
    entries: () => structuredClone(runtime.entries),
    historySubscriptionCount: () => runtime.historyListeners.size,
    navigateCount: () => runtime.navigations.length,
    navigations: () => structuredClone(runtime.navigations),
    owner,
    popStateSubscriptionCount: () => runtime.popListeners.size,
    resolveCurrent: () => {
      emit(runtime.resolvedListeners, readRouterLocation(runtime));
    },
    resolveHeldNavigation: () => {
      resolveHeldNavigation(runtime);
    },
    resolvedSubscriptionCount: () => runtime.resolvedListeners.size,
    setNavigationMode: (mode) => {
      runtime.mode = mode;
    },
    traverse: async (delta) => {
      await traverseHistory(delta, runtime);
    },
  };
}

function resolveHeldNavigation(runtime: HarnessRuntime): void {
  const location = runtime.heldResolvedLocation;
  if (location !== undefined) {
    runtime.heldResolvedLocation = undefined;
    emit(runtime.resolvedListeners, location);
  }
}

function createLocation(input: {
  readonly href: string;
  readonly index: number;
  readonly key?: string;
  readonly token?: string;
}): HistoryLocation {
  const key = input.key ?? `history-${String(input.index)}`;
  const url = new URL(input.href, "http://azurite.test");
  return {
    hash: url.hash,
    href: `${url.pathname}${url.search}${url.hash}`,
    pathname: url.pathname,
    search: url.search,
    state: {
      __TSR_index: input.index,
      __TSR_key: key,
      ...(input.token === undefined
        ? {}
        : { [applicationNavigationTokenStateKey]: input.token }),
      key,
    },
  };
}

function traversalAction(delta: number): "BACK" | "FORWARD" | "GO" {
  if (delta === -1) {
    return "BACK";
  }
  return delta === 1 ? "FORWARD" : "GO";
}

function readRouterLocation(runtime: HarnessRuntime): HistoryLocation {
  return requireLocation(runtime.entries, runtime.routerIndex);
}

function readBrowserLocation(runtime: HarnessRuntime): HistoryLocation {
  return requireLocation(runtime.entries, runtime.browserIndex);
}

function locationIdentity(location: HistoryLocation): BrowserIdentity {
  return {
    historyIndex: location.state.__TSR_index,
    historyKey: location.state.__TSR_key,
    href: location.href,
  };
}

function requireLocation(
  entries: readonly HistoryLocation[],
  index: number,
): HistoryLocation {
  const location = entries[index];
  if (location === undefined) {
    throw new Error(`Missing route-owner test location ${String(index)}.`);
  }
  return location;
}

function requireBlocker(runtime: HarnessRuntime): BlockerFn {
  if (runtime.blocker === undefined) {
    throw new Error("Route-owner test blocker is unavailable.");
  }
  return runtime.blocker;
}

async function callBlocker(
  runtime: HarnessRuntime,
  input: Parameters<BlockerFn>[0],
): Promise<boolean> {
  const decision: unknown = await requireBlocker(runtime)(input);
  return decision === true;
}

function subscribe<Listener>(
  listeners: Set<Listener>,
  listener: Listener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit<Argument>(
  listeners: ReadonlySet<(argument: Argument) => void>,
  argument: Argument,
): void {
  for (const listener of listeners) {
    listener(argument);
  }
}
