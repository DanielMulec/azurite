import { hasInvalidNoteSearch } from "./app-route-search.js";
import { consumePendingApplication } from "./route-application-navigation.js";
import type { HistoryAdmissionCandidate } from "./route-history-admission.js";
import {
  createControlledResult,
  nextRuntimeIdentity,
  type PendingApplicationNavigation,
  type RouteIntent,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type {
  RouteGateCause,
  RouteNavigationKind,
  RouteTransitionOutcome,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";
import {
  needsCanonicalReplacement,
  readApplicationNavigationToken,
  toTraversalNavigationKind,
  validateLocationOccurrence,
} from "./validated-route-location.js";

/** Creates and registers one intent from a TanStack history candidate. */
export function createHistoryRouteIntent(
  candidate: HistoryAdmissionCandidate,
  runtime: RouteTransitionRuntime,
): RouteIntent | undefined {
  runtime.generation += 1;
  const location = validateLocationOccurrence(
    candidate.nextLocation,
    runtime.generation,
  );
  return isApplicationAction(candidate.action)
    ? createApplicationEchoIntent(candidate, location, runtime)
    : createTraversalIntent(candidate, location, runtime);
}

/** Creates one seeded or in-place route intent without registering it. */
export function createCurrentRouteIntent(
  input: {
    readonly cause: RouteGateCause;
    readonly intentKey?: string;
    readonly kind: RouteNavigationKind;
    readonly location: ValidatedLocationOccurrence;
    readonly needsCanonicalReplacement: boolean;
    readonly noteId: string | undefined;
    readonly suppressStartupFallback?: boolean;
  },
  runtime: RouteTransitionRuntime,
): RouteIntent {
  return {
    ...input,
    gate: undefined,
    intentKey: input.intentKey ?? nextRuntimeIdentity(runtime, "intent"),
    result: createControlledResult<RouteTransitionOutcome>(),
    settled: false,
    suppressStartupFallback: input.suppressStartupFallback ?? false,
  };
}

/** Makes one immutable intent the sole current route authority. */
export function registerRouteIntent(
  intent: RouteIntent,
  runtime: RouteTransitionRuntime,
): void {
  runtime.currentIntentKey = intent.intentKey;
  runtime.activeIntents.set(intent.intentKey, intent);
}

function createApplicationEchoIntent(
  candidate: HistoryAdmissionCandidate,
  location: ValidatedLocationOccurrence,
  runtime: RouteTransitionRuntime,
): RouteIntent | undefined {
  const token = readApplicationNavigationToken(candidate.nextLocation);
  if (token === undefined) {
    return undefined;
  }
  const pending = consumePendingApplication(token, runtime);
  return pending === undefined
    ? undefined
    : bindPendingIntent({ candidate, location, pending }, runtime);
}

function bindPendingIntent(
  input: {
    readonly candidate: HistoryAdmissionCandidate;
    readonly location: ValidatedLocationOccurrence;
    readonly pending: PendingApplicationNavigation;
  },
  runtime: RouteTransitionRuntime,
): RouteIntent {
  const intent: RouteIntent = {
    ...input.pending,
    gate: undefined,
    location: input.location,
    needsCanonicalReplacement: needsCanonicalReplacement(
      input.candidate.nextLocation,
      input.location,
    ),
    settled: false,
  };
  registerRouteIntent(intent, runtime);
  return intent;
}

function createTraversalIntent(
  candidate: HistoryAdmissionCandidate,
  location: ValidatedLocationOccurrence,
  runtime: RouteTransitionRuntime,
): RouteIntent {
  const intent = createCurrentRouteIntent(
    {
      cause: "url_sync",
      kind: toTraversalNavigationKind(requireTraversalAction(candidate.action)),
      location,
      needsCanonicalReplacement: needsCanonicalReplacement(
        candidate.nextLocation,
        location,
      ),
      noteId: location.search.note,
      suppressStartupFallback: hasInvalidNoteSearch(
        candidate.nextLocation.search,
      ),
    },
    runtime,
  );
  registerRouteIntent(intent, runtime);
  return intent;
}

function requireTraversalAction(
  action: HistoryAdmissionCandidate["action"],
): "BACK" | "FORWARD" | "GO" {
  if (action === "PUSH" || action === "REPLACE") {
    throw new Error("Application history action reached traversal admission.");
  }
  return action;
}

function isApplicationAction(
  action: HistoryAdmissionCandidate["action"],
): boolean {
  return action === "PUSH" || action === "REPLACE";
}
