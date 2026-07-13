import {
  createNoteNavigationSearch,
  serializeAppSearch,
} from "./app-route-search.js";
import {
  completeRouteIntent,
  completePendingApplication,
  supersededOutcome,
} from "./route-intent-outcomes.js";
import {
  createControlledResult,
  nextRuntimeIdentity,
  type PendingApplicationNavigation,
  type RouteIntent,
  type RouteTransitionRouterAdapter,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type {
  RouteGateCause,
  RouteTransitionOutcome,
} from "./route-transition-types.js";

type ApplicationNavigationInput = {
  readonly cause: RouteGateCause;
  readonly kind: "application_push" | "canonical_replace" | "startup_replace";
  readonly noteId: string | undefined;
  readonly suppressStartupFallback?: boolean;
};

/** Starts a tokenized application navigation without trusting its promise. */
export function startApplicationNavigation(
  input: ApplicationNavigationInput,
  dependencies: {
    readonly router: RouteTransitionRouterAdapter;
    readonly runtime: RouteTransitionRuntime;
  },
): Promise<RouteTransitionOutcome> {
  supersedePendingApplication(dependencies.runtime);
  const pending = createPendingApplication(input, dependencies.runtime);
  dependencies.runtime.pendingApplications.set(pending.token, pending);
  dependencies.runtime.currentIntentKey = pending.intentKey;
  dependencies.runtime.storeRegistry
    .get()
    ?.activateRouteIntent(pending.intentKey);
  void dependencies.router
    .navigate({
      href: createDestinationHref(input.noteId, dependencies.runtime),
      replace: input.kind !== "application_push",
      token: pending.token,
    })
    .catch(() => {
      void failPendingNavigation(pending, dependencies.runtime);
    });
  return pending.result.promise;
}

/** Removes and returns the pending application request for its one echo. */
export function consumePendingApplication(
  token: string,
  runtime: RouteTransitionRuntime,
): PendingApplicationNavigation | undefined {
  const pending = runtime.pendingApplications.get(token);
  runtime.pendingApplications.delete(token);
  return pending;
}

function createPendingApplication(
  input: ApplicationNavigationInput,
  runtime: RouteTransitionRuntime,
): PendingApplicationNavigation {
  return {
    ...input,
    intentKey: nextRuntimeIdentity(runtime, "intent"),
    result: createControlledResult<RouteTransitionOutcome>(),
    suppressStartupFallback: input.suppressStartupFallback ?? false,
    token: nextRuntimeIdentity(runtime, "navigation"),
  };
}

function createDestinationHref(
  noteId: string | undefined,
  runtime: RouteTransitionRuntime,
): string {
  const current = runtime.currentOccurrence;
  const search =
    noteId === undefined
      ? current.search
      : createNoteNavigationSearch(current.search, noteId);
  return `${current.pathname}${serializeAppSearch(search)}${current.hash}`;
}

function supersedePendingApplication(runtime: RouteTransitionRuntime): void {
  const currentKey = runtime.currentIntentKey;
  if (currentKey === undefined) {
    return;
  }
  const pending = findPendingByIntentKey(currentKey, runtime);
  if (pending === undefined) {
    return;
  }
  runtime.pendingApplications.delete(pending.token);
  completePendingApplication(pending, {
    intentKey: pending.intentKey,
    noteId: pending.noteId,
    phase: "awaiting_location",
    status: "superseded",
    surfaceEffect: "none",
  });
}

function findPendingByIntentKey(
  intentKey: string,
  runtime: RouteTransitionRuntime,
): PendingApplicationNavigation | undefined {
  for (const pending of runtime.pendingApplications.values()) {
    if (pending.intentKey === intentKey) {
      return pending;
    }
  }
  return undefined;
}

async function failPendingNavigation(
  pending: PendingApplicationNavigation,
  runtime: RouteTransitionRuntime,
): Promise<void> {
  if (runtime.pendingApplications.delete(pending.token)) {
    const outcome =
      runtime.currentIntentKey === pending.intentKey
        ? navigationRejectedOutcome(pending)
        : pendingSupersededOutcome(pending, runtime);
    completePendingApplication(pending, outcome);
    return;
  }
  await failAdmittedNavigation(pending, runtime);
}

async function failAdmittedNavigation(
  pending: PendingApplicationNavigation,
  runtime: RouteTransitionRuntime,
): Promise<void> {
  const intent = runtime.activeIntents.get(pending.intentKey);
  if (intent?.gate === undefined) {
    return;
  }
  const outcome = getAdmittedNavigationFailure(pending, intent, runtime);
  await completeRouteIntent({ gate: intent.gate, intent, outcome }, runtime);
}

function getAdmittedNavigationFailure(
  pending: PendingApplicationNavigation,
  intent: RouteIntent,
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  return runtime.currentIntentKey === pending.intentKey
    ? navigationRejectedOutcome(pending)
    : supersededOutcome(intent, "awaiting_location");
}

function navigationRejectedOutcome(
  pending: PendingApplicationNavigation,
): RouteTransitionOutcome {
  return {
    intentKey: pending.intentKey,
    noteId: pending.noteId,
    reason: "navigation_rejected",
    status: "failed",
    surfaceEffect: "retained",
  };
}

function pendingSupersededOutcome(
  pending: PendingApplicationNavigation,
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  return supersededOutcome(
    {
      ...pending,
      gate: undefined,
      location: runtime.currentOccurrence,
      needsCanonicalReplacement: false,
      settled: false,
    },
    "awaiting_location",
  );
}
