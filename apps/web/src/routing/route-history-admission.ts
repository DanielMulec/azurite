import type {
  BlockerFn,
  HistoryLocation,
  RouterHistory,
} from "@tanstack/react-router";

type HistoryBlockerInput = Parameters<BlockerFn>[0];

/** Candidate presented before application history mutation or router notification. */
export type HistoryAdmissionCandidate = HistoryBlockerInput & {
  readonly restoration: Promise<boolean> | undefined;
};

type HistoryAdmissionDecision = {
  readonly block: boolean;
};

type BrowserLocationIdentity = {
  readonly historyIndex: number | undefined;
  readonly historyKey: string | undefined;
  readonly href: string;
};

type PendingRestoration = {
  readonly expected: BrowserLocationIdentity;
  readonly resolve: (confirmed: boolean) => void;
};

type RouteHistoryAdmissionOptions = {
  readonly confirmRestoration?: (
    expected: BrowserLocationIdentity,
    actual: BrowserLocationIdentity,
  ) => boolean;
  readonly history: RouterHistory;
  readonly onCandidate: (
    candidate: HistoryAdmissionCandidate,
  ) => Promise<HistoryAdmissionDecision> | HistoryAdmissionDecision;
  readonly readBrowserLocation?: () => BrowserLocationIdentity;
  readonly subscribeToPopState?: (listener: () => void) => () => void;
};

/** Installed TanStack history boundary used by the route-transition owner. */
export type RouteHistoryAdmission = {
  readonly dispose: () => void;
};

/** Registers action-aware admission and exact traversal-restoration proof. */
export function createRouteHistoryAdmission(
  options: RouteHistoryAdmissionOptions,
): RouteHistoryAdmission {
  let pendingRestoration: PendingRestoration | undefined;
  const readBrowserLocation =
    options.readBrowserLocation ?? readCurrentBrowserLocation;
  const removePopStateListener = (
    options.subscribeToPopState ?? subscribeToBrowserPopState
  )(() => {
    if (pendingRestoration === undefined) {
      return;
    }
    const actual = readBrowserLocation();
    const confirmed =
      isExactLocation(pendingRestoration.expected, actual) &&
      (options.confirmRestoration?.(pendingRestoration.expected, actual) ??
        true);
    pendingRestoration.resolve(confirmed);
    pendingRestoration = undefined;
  });
  const unblock = options.history.block({
    blockerFn: async (input) => {
      const restoration = isTraversal(input.action)
        ? createRestorationPromise()
        : undefined;
      const decision = await options.onCandidate({
        ...input,
        restoration: restoration?.promise,
      });
      if (!decision.block || restoration === undefined) {
        restoration?.resolve(false);
        return decision.block;
      }

      const predecessor = toLocationIdentity(input.currentLocation);
      if (isExactLocation(predecessor, readBrowserLocation())) {
        restoration.resolve(true);
        return false;
      }
      pendingRestoration?.resolve(false);
      pendingRestoration = {
        expected: predecessor,
        resolve: restoration.resolve,
      };
      return true;
    },
    enableBeforeUnload: false,
  });

  return {
    dispose: () => {
      pendingRestoration?.resolve(false);
      pendingRestoration = undefined;
      unblock();
      removePopStateListener();
    },
  };
}

function createRestorationPromise(): {
  readonly promise: Promise<boolean>;
  readonly resolve: (confirmed: boolean) => void;
} {
  let resolvePromise: (confirmed: boolean) => void = () => {};
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function isTraversal(action: HistoryBlockerInput["action"]): boolean {
  return action === "BACK" || action === "FORWARD" || action === "GO";
}

function toLocationIdentity(
  location: HistoryLocation,
): BrowserLocationIdentity {
  return {
    historyIndex: location.state.__TSR_index,
    historyKey: location.state.__TSR_key,
    href: location.href,
  };
}

function readCurrentBrowserLocation(): BrowserLocationIdentity {
  const state: unknown = window.history.state;
  return {
    historyIndex: readNumberProperty(state, "__TSR_index"),
    historyKey: readStringProperty(state, "__TSR_key"),
    href: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  };
}

function readNumberProperty(
  value: unknown,
  property: string,
): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const propertyValue = Reflect.get(value, property);
  return typeof propertyValue === "number" ? propertyValue : undefined;
}

function readStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const propertyValue = Reflect.get(value, property);
  return typeof propertyValue === "string" ? propertyValue : undefined;
}

function isExactLocation(
  expected: BrowserLocationIdentity,
  actual: BrowserLocationIdentity,
): boolean {
  return (
    expected.historyIndex === actual.historyIndex &&
    expected.historyKey === actual.historyKey &&
    expected.href === actual.href
  );
}

function subscribeToBrowserPopState(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener("popstate", listener);
  };
}
