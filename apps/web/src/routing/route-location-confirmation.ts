import type { HistoryLocation } from "@tanstack/react-router";

import {
  createControlledResult,
  occurrenceIdentity,
  type LocationConfirmation,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type { ValidatedLocationOccurrence } from "./route-transition-types.js";

/** Registers the two signals required for exact route occurrence completion. */
export function registerLocationConfirmation(
  occurrence: ValidatedLocationOccurrence,
  initialState: { readonly historySeen: boolean; readonly resolvedSeen: boolean },
  runtime: RouteTransitionRuntime,
): Promise<void> {
  const confirmation: LocationConfirmation = {
    ...initialState,
    occurrence,
    result: createControlledResult<void>(),
  };
  runtime.locationConfirmations.set(occurrenceIdentity(occurrence), confirmation);
  resolveCompletedConfirmation(confirmation, runtime);
  return confirmation.result.promise;
}

/** Marks the exact TanStack history occurrence as installed. */
export function markHistoryOccurrence(
  location: HistoryLocation,
  runtime: RouteTransitionRuntime,
): void {
  const confirmation = findConfirmation(location, runtime);
  if (confirmation === undefined) {
    return;
  }
  confirmation.historySeen = true;
  runtime.currentOccurrence = confirmation.occurrence;
  resolveCompletedConfirmation(confirmation, runtime);
}

/** Marks the exact router lifecycle occurrence as fully resolved. */
export function markResolvedOccurrence(
  location: HistoryLocation,
  runtime: RouteTransitionRuntime,
): void {
  const confirmation = findConfirmation(location, runtime);
  if (confirmation === undefined) {
    return;
  }
  confirmation.resolvedSeen = true;
  resolveCompletedConfirmation(confirmation, runtime);
}

function findConfirmation(
  location: HistoryLocation,
  runtime: RouteTransitionRuntime,
): LocationConfirmation | undefined {
  const key = location.state.__TSR_key;
  if (typeof key !== "string") {
    return undefined;
  }
  return runtime.locationConfirmations.get(
    occurrenceIdentity({
      historyIndex: location.state.__TSR_index,
      historyKey: key,
    }),
  );
}

function resolveCompletedConfirmation(
  confirmation: LocationConfirmation,
  runtime: RouteTransitionRuntime,
): void {
  if (!confirmation.historySeen || !confirmation.resolvedSeen) {
    return;
  }
  runtime.locationConfirmations.delete(
    occurrenceIdentity(confirmation.occurrence),
  );
  confirmation.result.resolve();
}
