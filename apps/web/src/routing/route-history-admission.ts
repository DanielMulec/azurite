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

type HistoryAdmissionRuntime = {
  readonly options: RouteHistoryAdmissionOptions;
  pendingRestoration: PendingRestoration | undefined;
  readonly readBrowserLocation: () => BrowserLocationIdentity;
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
  const runtime: HistoryAdmissionRuntime = {
    options,
    pendingRestoration: undefined,
    readBrowserLocation:
      options.readBrowserLocation ?? readCurrentBrowserLocation,
  };
  const removePopStateListener = (
    options.subscribeToPopState ?? subscribeToBrowserPopState
  )(() => {
    confirmPendingRestoration(runtime);
  });
  const unblock = options.history.block({
    blockerFn: async (input) => await handleBlocker(input, runtime),
    enableBeforeUnload: false,
  });

  return {
    dispose: () => {
      disposeAdmission({ removePopStateListener, unblock }, runtime);
    },
  };
}

async function handleBlocker(
  input: HistoryBlockerInput,
  runtime: HistoryAdmissionRuntime,
): Promise<boolean> {
  const restoration = createTraversalRestoration(input.action);
  const decision = await runtime.options.onCandidate({
    ...input,
    restoration: restoration?.promise,
  });
  const directDecision = resolveDirectDecision(decision, restoration);
  if (directDecision !== undefined) {
    return directDecision;
  }
  return handleBlockedTraversal(input, requireRestoration(restoration), runtime);
}

function handleBlockedTraversal(
  input: HistoryBlockerInput,
  restoration: ReturnType<typeof createRestorationPromise>,
  runtime: HistoryAdmissionRuntime,
): boolean {
  const predecessor = toLocationIdentity(input.currentLocation);
  if (isExactLocation(predecessor, runtime.readBrowserLocation())) {
    restoration.resolve(true);
    return false;
  }
  runtime.pendingRestoration?.resolve(false);
  runtime.pendingRestoration = {
    expected: predecessor,
    resolve: restoration.resolve,
  };
  return true;
}

function createTraversalRestoration(
  action: HistoryBlockerInput["action"],
): ReturnType<typeof createRestorationPromise> | undefined {
  return isTraversal(action) ? createRestorationPromise() : undefined;
}

function resolveDirectDecision(
  decision: HistoryAdmissionDecision,
  restoration: ReturnType<typeof createRestorationPromise> | undefined,
): boolean | undefined {
  if (canBlockTraversal(decision, restoration)) {
    return undefined;
  }
  resolveUnusedRestoration(restoration);
  return decision.block;
}

function canBlockTraversal(
  decision: HistoryAdmissionDecision,
  restoration: ReturnType<typeof createRestorationPromise> | undefined,
): boolean {
  return decision.block && restoration !== undefined;
}

function resolveUnusedRestoration(
  restoration: ReturnType<typeof createRestorationPromise> | undefined,
): void {
  if (restoration !== undefined) {
    restoration.resolve(false);
  }
}

function requireRestoration(
  restoration: ReturnType<typeof createRestorationPromise> | undefined,
): ReturnType<typeof createRestorationPromise> {
  if (restoration === undefined) {
    throw new Error("Blocked traversal has no restoration owner.");
  }
  return restoration;
}

function confirmPendingRestoration(runtime: HistoryAdmissionRuntime): void {
  const pending = runtime.pendingRestoration;
  if (pending === undefined) {
    return;
  }
  const actual = runtime.readBrowserLocation();
  pending.resolve(isConfirmedRestoration(pending.expected, actual, runtime));
  runtime.pendingRestoration = undefined;
}

function isConfirmedRestoration(
  expected: BrowserLocationIdentity,
  actual: BrowserLocationIdentity,
  runtime: HistoryAdmissionRuntime,
): boolean {
  if (!isExactLocation(expected, actual)) {
    return false;
  }
  return applyRestorationPolicy(expected, actual, runtime);
}

function applyRestorationPolicy(
  expected: BrowserLocationIdentity,
  actual: BrowserLocationIdentity,
  runtime: HistoryAdmissionRuntime,
): boolean {
  const confirm = runtime.options.confirmRestoration;
  return confirm === undefined ? true : confirm(expected, actual);
}

function disposeAdmission(
  resources: {
    readonly removePopStateListener: () => void;
    readonly unblock: () => void;
  },
  runtime: HistoryAdmissionRuntime,
): void {
  runtime.pendingRestoration?.resolve(false);
  runtime.pendingRestoration = undefined;
  resources.unblock();
  resources.removePopStateListener();
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
  const propertyValue = readUnknownProperty(value, property);
  return typeof propertyValue === "number" ? propertyValue : undefined;
}

function readStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  const propertyValue = readUnknownProperty(value, property);
  return typeof propertyValue === "string" ? propertyValue : undefined;
}

function readUnknownProperty(value: unknown, property: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Readonly<Record<string, unknown>>;
  return record[property];
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
