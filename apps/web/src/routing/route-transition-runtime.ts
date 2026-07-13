import type { HistoryLocation } from "@tanstack/react-router";

import type { RouteGateRegistry } from "./route-gate-registry.js";
import type { RouteStoreExecutorRegistry } from "./route-store-executor.js";
import type {
  RouteGateCause,
  RouteNavigationKind,
  RouteTransitionOutcome,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";

export type ControlledResult<Result> = {
  readonly promise: Promise<Result>;
  readonly resolve: (result: Result) => void;
};

export type RouteIntent = {
  readonly cause: RouteGateCause;
  readonly intentKey: string;
  readonly kind: RouteNavigationKind;
  readonly location: ValidatedLocationOccurrence;
  readonly needsCanonicalReplacement: boolean;
  readonly noteId: string | undefined;
  readonly result: ControlledResult<RouteTransitionOutcome>;
  settled: boolean;
};

export type PendingApplicationNavigation = {
  readonly cause: RouteGateCause;
  readonly intentKey: string;
  readonly kind:
    | "application_push"
    | "canonical_replace"
    | "startup_replace";
  readonly noteId: string | undefined;
  readonly result: ControlledResult<RouteTransitionOutcome>;
  readonly token: string;
};

export type LocationConfirmation = {
  historySeen: boolean;
  readonly occurrence: ValidatedLocationOccurrence;
  readonly result: ControlledResult<void>;
  resolvedSeen: boolean;
};

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

export function createControlledResult<Result>(): ControlledResult<Result> {
  let resolveResult: (result: Result) => void = () => {};
  const promise = new Promise<Result>((resolve) => {
    resolveResult = resolve;
  });
  return { promise, resolve: resolveResult };
}

export function nextRuntimeIdentity(
  runtime: RouteTransitionRuntime,
  prefix: string,
): string {
  runtime.identity += 1;
  return `${prefix}-${String(runtime.identity)}`;
}

export function occurrenceIdentity(
  occurrence: Pick<
    ValidatedLocationOccurrence,
    "historyIndex" | "historyKey"
  >,
): string {
  return `${occurrence.historyKey}:${String(occurrence.historyIndex)}`;
}

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
