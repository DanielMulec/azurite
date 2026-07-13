import { startApplicationNavigation } from "./route-application-navigation.js";
import { createRouteGateRegistry } from "./route-gate-registry.js";
import {
  createRouteHistoryAdmission,
  type RouteHistoryAdmission,
} from "./route-history-admission.js";
import {
  admitCurrentOccurrence,
  admitHistoryCandidate,
} from "./route-intent-admission.js";
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
  isSameHistoryOccurrence,
  needsCanonicalReplacement,
  validateLocationOccurrence,
} from "./validated-route-location.js";

type RouteTransitionOwnerOptions = {
  readonly confirmRestoration?: Parameters<
    typeof createRouteHistoryAdmission
  >[0]["confirmRestoration"];
  readonly history: Parameters<typeof createRouteHistoryAdmission>[0]["history"];
  readonly router: RouteTransitionRouterAdapter;
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
    ...(options.confirmRestoration === undefined
      ? {}
      : { confirmRestoration: options.confirmRestoration }),
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
      disposeOwner(
        { historyAdmission, removeHistorySubscription, removeResolvedSubscription },
        runtime,
      );
    },
    registerGate: runtime.gateRegistry.register,
    registerStoreExecutor: (executor) =>
      registerStoreExecutor(executor, runtime),
    selectNote: async (noteId) =>
      await selectNote(noteId, dependencies),
  };
}

function createRuntime(initialLocation: Parameters<typeof validateLocationOccurrence>[0]): RouteTransitionRuntime {
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
  const sameTarget =
    dependencies.runtime.currentOccurrence.search.note === noteId;
  if (!sameTarget) {
    return await startApplicationNavigation(
      { cause: "note_list", kind: "application_push", noteId },
      dependencies,
    );
  }
  const joined = findJoinedCurrentIntent(noteId, dependencies.runtime);
  if (joined !== undefined) {
    return await joined;
  }
  const coherent = dependencies.runtime.storeRegistry
    .get()
    ?.getCoherentView(dependencies.runtime.currentOccurrence, noteId);
  if (coherent?.status === "coherent_noop") {
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

function findJoinedCurrentIntent(
  noteId: string,
  runtime: RouteTransitionRuntime,
): Promise<RouteTransitionOutcome> | undefined {
  const currentKey = runtime.currentIntentKey;
  if (currentKey === undefined) {
    return undefined;
  }
  const active = runtime.activeIntents.get(currentKey);
  if (isMatchingActiveIntent(active, noteId, runtime)) {
    return active.result.promise;
  }
  return findMatchingPending(currentKey, noteId, runtime)?.result.promise;
}

function isMatchingActiveIntent(
  intent: RouteIntent | undefined,
  noteId: string,
  runtime: RouteTransitionRuntime,
): intent is RouteIntent {
  return (
    intent !== undefined &&
    !intent.settled &&
    intent.noteId === noteId &&
    isSameHistoryOccurrence(intent.location, runtime.currentOccurrence)
  );
}

function findMatchingPending(
  intentKey: string,
  noteId: string,
  runtime: RouteTransitionRuntime,
): PendingApplicationNavigation | undefined {
  for (const pending of runtime.pendingApplications.values()) {
    if (pending.intentKey === intentKey && pending.noteId === noteId) {
      return pending;
    }
  }
  return undefined;
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

function disposeOwner(
  resources: {
    readonly historyAdmission: RouteHistoryAdmission;
    readonly removeHistorySubscription: () => void;
    readonly removeResolvedSubscription: () => void;
  },
  runtime: RouteTransitionRuntime,
): void {
  if (runtime.disposed) {
    return;
  }
  runtime.disposed = true;
  resources.historyAdmission.dispose();
  resources.removeHistorySubscription();
  resources.removeResolvedSubscription();
  for (const confirmation of runtime.locationConfirmations.values()) {
    confirmation.result.resolve();
  }
  runtime.locationConfirmations.clear();
  runtime.storeRegistry.dispose();
  settlePendingOnDisposal(runtime);
}

function settlePendingOnDisposal(runtime: RouteTransitionRuntime): void {
  for (const pending of runtime.pendingApplications.values()) {
    pending.result.resolve({
      intentKey: pending.intentKey,
      noteId: pending.noteId,
      reason: "owner_disposed",
      status: "failed",
      surfaceEffect: "none",
    });
  }
  runtime.pendingApplications.clear();
}
