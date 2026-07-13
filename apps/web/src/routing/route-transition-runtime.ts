import type { HistoryLocation } from "@tanstack/react-router";

import type { PreparedRouteGate } from "./route-gate-registry.js";
import type { RouteGateRegistry } from "./route-gate-registry.js";
import type { RouteStoreExecutorRegistry } from "./route-store-executor.js";
import type {
  RouteGateCause,
  RouteNavigationKind,
  RouteTransitionOutcome,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";

/** Promise and resolver pair retained by one owned runtime operation. */
export type ControlledResult<Result> = {
  readonly promise: Promise<Result>;
  readonly resolve: (result: Result) => void;
};

/** Internal immutable intent identity plus its terminal result owner. */
export type RouteIntent = {
  readonly cause: RouteGateCause;
  readonly intentKey: string;
  readonly kind: RouteNavigationKind;
  readonly location: ValidatedLocationOccurrence;
  readonly needsCanonicalReplacement: boolean;
  readonly noteId: string | undefined;
  readonly result: ControlledResult<RouteTransitionOutcome>;
  gate: PreparedRouteGate | undefined;
  settled: boolean;
  readonly suppressStartupFallback: boolean;
};

/** Tokenized application request waiting for its one history echo. */
export type PendingApplicationNavigation = {
  readonly cause: RouteGateCause;
  readonly intentKey: string;
  readonly kind: "application_push" | "canonical_replace" | "startup_replace";
  readonly noteId: string | undefined;
  readonly result: ControlledResult<RouteTransitionOutcome>;
  readonly suppressStartupFallback: boolean;
  readonly token: string;
};

/** Two-signal completion state for one exact history occurrence. */
export type LocationConfirmation = {
  historySeen: boolean;
  readonly occurrence: ValidatedLocationOccurrence;
  readonly result: ControlledResult<undefined>;
  resolvedSeen: boolean;
};

/** Mutable ephemeral state owned by one route-transition owner. */
export type RouteTransitionRuntime = {
  readonly activeIntents: Map<string, RouteIntent>;
  currentIntentKey: string | undefined;
  currentOccurrence: ValidatedLocationOccurrence;
  disposed: boolean;
  generation: number;
  readonly gateRegistry: RouteGateRegistry;
  identity: number;
  readonly locationConfirmations: Map<string, LocationConfirmation>;
  readonly pendingApplications: Map<string, PendingApplicationNavigation>;
  readonly storeRegistry: RouteStoreExecutorRegistry;
};

/** Narrow TanStack adapter consumed by the framework-neutral route owner. */
export type RouteTransitionRouterAdapter = {
  readonly historyLocation: () => HistoryLocation;
  readonly navigate: (input: {
    readonly href: string;
    readonly replace: boolean;
    readonly token: string;
  }) => Promise<void>;
  readonly subscribeHistory: (
    listener: (location: HistoryLocation) => void,
  ) => () => void;
  readonly subscribeResolved: (
    listener: (location: HistoryLocation) => void,
  ) => () => void;
};

/** Creates one promise with an exactly owned resolver. */
export function createControlledResult<Result>(): ControlledResult<Result> {
  let resolveResult: (result: Result) => void = () => {};
  const promise = new Promise<Result>((resolve) => {
    resolveResult = resolve;
  });
  return { promise, resolve: resolveResult };
}

/** Allocates one owner-local unique identity. */
export function nextRuntimeIdentity(
  runtime: RouteTransitionRuntime,
  prefix: string,
): string {
  runtime.identity += 1;
  return `${prefix}-${String(runtime.identity)}`;
}

/** Creates the stable map key for one exact history occurrence. */
export function occurrenceIdentity(
  occurrence: Pick<ValidatedLocationOccurrence, "historyIndex" | "historyKey">,
): string {
  return `${occurrence.historyKey}:${String(occurrence.historyIndex)}`;
}

/** Returns whether an unsettled intent remains the owner's latest intent. */
export function isCurrentIntent(
  intent: RouteIntent,
  runtime: RouteTransitionRuntime,
): boolean {
  return (
    !runtime.disposed &&
    !intent.settled &&
    runtime.currentIntentKey === intent.intentKey
  );
}
