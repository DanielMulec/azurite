import { hasInvalidNoteSearch } from "./app-route-search.js";
import { startApplicationNavigation } from "./route-application-navigation.js";
import { createRouteGateRegistry } from "./route-gate-registry.js";
import { createRouteHistoryAdmission } from "./route-history-admission.js";
import {
  admitCurrentOccurrence,
  admitHistoryCandidate,
} from "./route-intent-admission.js";
import {
  disposeRouteTransitionOwner,
  ownerDisposedSelection,
} from "./route-owner-disposal.js";
import {
  markHistoryOccurrence,
  markResolvedOccurrence,
  registerLocationConfirmation,
} from "./route-location-confirmation.js";
import {
  createRouteStoreExecutorRegistry,
  type RouteStoreExecutor,
} from "./route-store-executor.js";
import {
  nextRuntimeIdentity,
  type PendingApplicationNavigation,
  type RouteIntent,
  type RouteTransitionRouterAdapter,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type {
  RouteTransitionGate,
  RouteTransitionOutcome,
} from "./route-transition-types.js";
import {
  needsCanonicalReplacement,
  validateLocationOccurrence,
} from "./validated-route-location.js";

type RouteTransitionOwnerOptions = {
  readonly confirmRestoration?: Parameters<
    typeof createRouteHistoryAdmission
  >[0]["confirmRestoration"];
  readonly history: Parameters<
    typeof createRouteHistoryAdmission
  >[0]["history"];
  readonly readBrowserLocation?: Parameters<
    typeof createRouteHistoryAdmission
  >[0]["readBrowserLocation"];
  readonly router: RouteTransitionRouterAdapter;
  readonly subscribeToPopState?: Parameters<
    typeof createRouteHistoryAdmission
  >[0]["subscribeToPopState"];
};

/** Single runtime owner for route intent, history admission, and completion. */
export type RouteTransitionOwner = {
  readonly dispose: () => void;
  readonly registerGate: (gate: RouteTransitionGate) => () => void;
  readonly registerStoreExecutor: (executor: RouteStoreExecutor) => () => void;
  readonly selectNote: (noteId: string) => Promise<RouteTransitionOutcome>;
};

/** Constructs and starts one route-transition owner before React renders. */
export function createRouteTransitionOwner(
  options: RouteTransitionOwnerOptions,
): RouteTransitionOwner {
  const runtime = createRuntime(options.router.historyLocation());
  const dependencies = { router: options.router, runtime };
  const historyAdmission = createRouteHistoryAdmission({
    ...getRestorationOption(options),
    ...getBrowserAdmissionOptions(options),
    history: options.history,
    onCandidate: async (candidate) =>
      await admitHistoryCandidate(candidate, dependencies),
  });
  const removeHistorySubscription = options.router.subscribeHistory(
    (location) => {
      markHistoryOccurrence(location, runtime);
    },
  );
  const removeResolvedSubscription = options.router.subscribeResolved(
    (location) => {
      markResolvedOccurrence(location, runtime);
    },
  );
  startInitialIntent(options.router.historyLocation(), dependencies);

  return {
    dispose: () => {
      disposeRouteTransitionOwner(
        {
          historyAdmission,
          removeHistorySubscription,
          removeResolvedSubscription,
        },
        runtime,
      );
    },
    registerGate: (gate) =>
      runtime.disposed ? () => {} : runtime.gateRegistry.register(gate),
    registerStoreExecutor: (executor) =>
      registerStoreExecutor(executor, runtime),
    selectNote: async (noteId) => await selectNote(noteId, dependencies),
  };
}

function getRestorationOption(options: RouteTransitionOwnerOptions) {
  return options.confirmRestoration === undefined
    ? {}
    : { confirmRestoration: options.confirmRestoration };
}

function getBrowserAdmissionOptions(options: RouteTransitionOwnerOptions) {
  return {
    ...(options.readBrowserLocation === undefined
      ? {}
      : { readBrowserLocation: options.readBrowserLocation }),
    ...(options.subscribeToPopState === undefined
      ? {}
      : { subscribeToPopState: options.subscribeToPopState }),
  };
}

function createRuntime(
  initialLocation: Parameters<typeof validateLocationOccurrence>[0],
): RouteTransitionRuntime {
  const gateRegistry = createRouteGateRegistry();
  const storeRegistry = createRouteStoreExecutorRegistry();
  const initialOccurrence = validateLocationOccurrence(initialLocation, 1);
  return {
    activeIntents: new Map(),
    currentIntentKey: undefined,
    currentOccurrence: initialOccurrence,
    disposed: false,
    gateRegistry,
    generation: 1,
    identity: 0,
    locationConfirmations: new Map(),
    pendingApplications: new Map(),
    storeRegistry,
  };
}

function startInitialIntent(
  location: Parameters<typeof validateLocationOccurrence>[0],
  dependencies: {
    readonly router: RouteTransitionRouterAdapter;
    readonly runtime: RouteTransitionRuntime;
  },
): void {
  const occurrence = dependencies.runtime.currentOccurrence;
  const confirmation = registerLocationConfirmation(
    occurrence,
    { historySeen: true, resolvedSeen: false },
    dependencies.runtime,
  );
  void admitCurrentOccurrence(
    {
      cause: "url_sync",
      confirmation,
      kind: "initial",
      location: occurrence,
      needsCanonicalReplacement: needsCanonicalReplacement(
        location,
        occurrence,
      ),
      noteId: occurrence.search.note,
      suppressStartupFallback: hasInvalidNoteSearch(location.search),
    },
    dependencies,
  );
}

async function selectNote(
  noteId: string,
  dependencies: {
    readonly router: RouteTransitionRouterAdapter;
    readonly runtime: RouteTransitionRuntime;
  },
): Promise<RouteTransitionOutcome> {
  if (dependencies.runtime.disposed) {
    return ownerDisposedSelection(noteId, dependencies.runtime);
  }
  return await selectAvailableNote(noteId, dependencies);
}

async function selectAvailableNote(
  noteId: string,
  dependencies: {
    readonly router: RouteTransitionRouterAdapter;
    readonly runtime: RouteTransitionRuntime;
  },
): Promise<RouteTransitionOutcome> {
  const joined = findJoinedCurrentIntent(noteId, dependencies.runtime);
  if (joined !== undefined) {
    return await joined;
  }
  const sameTarget =
    dependencies.runtime.currentOccurrence.search.note === noteId;
  if (!sameTarget) {
    return await startApplicationNavigation(
      { cause: "note_list", kind: "application_push", noteId },
      dependencies,
    );
  }
  return await selectSameTargetNote(noteId, dependencies);
}

async function selectSameTargetNote(
  noteId: string,
  dependencies: {
    readonly router: RouteTransitionRouterAdapter;
    readonly runtime: RouteTransitionRuntime;
  },
): Promise<RouteTransitionOutcome> {
  return await selectUnjoinedSameTarget(noteId, dependencies);
}

async function selectUnjoinedSameTarget(
  noteId: string,
  dependencies: {
    readonly router: RouteTransitionRouterAdapter;
    readonly runtime: RouteTransitionRuntime;
  },
): Promise<RouteTransitionOutcome> {
  const coherent = getCoherentView(noteId, dependencies.runtime);
  if (coherent !== undefined) {
    return createDirectNoop(noteId, coherent.view, dependencies.runtime);
  }
  return await admitCurrentOccurrence(
    {
      cause: "note_list",
      confirmation: Promise.resolve(),
      kind: "application_push",
      location: dependencies.runtime.currentOccurrence,
      needsCanonicalReplacement: false,
      noteId,
    },
    dependencies,
  );
}

function getCoherentView(
  noteId: string,
  runtime: RouteTransitionRuntime,
):
  | Extract<
      ReturnType<RouteStoreExecutor["getCoherentView"]>,
      { status: "coherent_noop" }
    >
  | undefined {
  const executor = runtime.storeRegistry.get();
  if (executor === undefined) {
    return undefined;
  }
  const result = executor.getCoherentView(runtime.currentOccurrence, noteId);
  return readCoherentResult(result);
}

function readCoherentResult(
  result: ReturnType<RouteStoreExecutor["getCoherentView"]>,
):
  | Extract<
      ReturnType<RouteStoreExecutor["getCoherentView"]>,
      { status: "coherent_noop" }
    >
  | undefined {
  return result?.status === "coherent_noop" ? result : undefined;
}

function findJoinedCurrentIntent(
  noteId: string,
  runtime: RouteTransitionRuntime,
): Promise<RouteTransitionOutcome> | undefined {
  const currentKey = runtime.currentIntentKey;
  if (currentKey === undefined) {
    return undefined;
  }
  const active = runtime.activeIntents.get(currentKey);
  const activePromise = getMatchingActivePromise(active, noteId);
  if (activePromise !== undefined) {
    return activePromise;
  }
  return getMatchingPendingPromise(currentKey, noteId, runtime);
}

function getMatchingPendingPromise(
  intentKey: string,
  noteId: string,
  runtime: RouteTransitionRuntime,
): Promise<RouteTransitionOutcome> | undefined {
  return findMatchingPending(intentKey, noteId, runtime)?.result.promise;
}

function getMatchingActivePromise(
  intent: RouteIntent | undefined,
  noteId: string,
): Promise<RouteTransitionOutcome> | undefined {
  return isMatchingActiveIntent(intent, noteId)
    ? intent.result.promise
    : undefined;
}

function isMatchingActiveIntent(
  intent: RouteIntent | undefined,
  noteId: string,
): intent is RouteIntent {
  if (intent === undefined || intent.settled) {
    return false;
  }
  return intent.noteId === noteId;
}

function findMatchingPending(
  intentKey: string,
  noteId: string,
  runtime: RouteTransitionRuntime,
): PendingApplicationNavigation | undefined {
  return Array.from(runtime.pendingApplications.values()).find(
    (pending) => pending.intentKey === intentKey && pending.noteId === noteId,
  );
}

function createDirectNoop(
  noteId: string,
  view: "empty" | "error" | "missing" | "missing_draft" | "ready",
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  if (view === "empty") {
    throw new Error("A note target cannot own an empty coherent view.");
  }
  return {
    intentKey: nextRuntimeIdentity(runtime, "intent"),
    noteId,
    status: "coherent_noop",
    surfaceEffect: "retained",
    view,
  };
}

function registerStoreExecutor(
  executor: RouteStoreExecutor,
  runtime: RouteTransitionRuntime,
): () => void {
  const unregister = runtime.storeRegistry.register(executor);
  if (runtime.currentIntentKey !== undefined) {
    executor.activateRouteIntent(runtime.currentIntentKey);
  }
  return unregister;
}
