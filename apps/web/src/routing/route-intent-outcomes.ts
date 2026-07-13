import type { PreparedRouteGate } from "./route-gate-registry.js";
import type { RouteStoreApplyResult } from "./route-store-executor.js";
import type {
  PendingApplicationNavigation,
  RouteIntent,
  RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type {
  RouteTransitionOutcome,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";

/** Settles one admitted intent and its captured gate exactly once. */
export async function completeRouteIntent(
  input: {
    readonly gate: PreparedRouteGate;
    readonly intent: RouteIntent;
    readonly outcome: RouteTransitionOutcome;
  },
  runtime: RouteTransitionRuntime,
): Promise<void> {
  if (input.intent.settled) {
    return;
  }
  input.intent.settled = true;
  runtime.activeIntents.delete(input.intent.intentKey);
  await input.gate.settle({
    leaseKey: gateLeaseKey(input.intent.intentKey),
    surfaceEffect: input.outcome.surfaceEffect,
    terminalStatus: input.outcome.status,
  });
  input.intent.result.resolve(input.outcome);
}

/** Settles a not-yet-admitted application request. */
export function completePendingApplication(
  pending: PendingApplicationNavigation,
  outcome: RouteTransitionOutcome,
): void {
  pending.result.resolve(outcome);
}

/** Creates the exact top-level stale result for one await phase. */
export function supersededOutcome(
  intent: RouteIntent,
  phase: Extract<RouteTransitionOutcome, { status: "superseded" }>["phase"],
): RouteTransitionOutcome {
  return {
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    phase,
    status: "superseded",
    surfaceEffect: "none",
  };
}

/** Maps a store terminal surface result into the route outcome contract. */
export function mapStoreOutcome(
  intent: RouteIntent,
  result: RouteStoreApplyResult,
): RouteTransitionOutcome {
  if (result.status === "applied") {
    return mapAppliedOutcome(intent, result);
  }
  return mapNonAppliedOutcome(intent, result);
}

function mapNonAppliedOutcome(
  intent: RouteIntent,
  result: Exclude<RouteStoreApplyResult, { status: "applied" }>,
): RouteTransitionOutcome {
  if (result.status === "coherent_noop") {
    return coherentNoopOutcome(intent, result.view);
  }
  if (result.status === "failed") {
    return mapFailedOutcome(intent, result.reason);
  }
  return supersededOutcome(intent, "awaiting_read");
}

/** Returns the exact location identity expected by one route intent. */
export function intentLocation(
  intent: RouteIntent,
): ValidatedLocationOccurrence {
  return intent.location;
}

/** Returns the deterministic lease key allocated for one route intent. */
export function gateLeaseKey(intentKey: string): string {
  return `${intentKey}:gate`;
}

function mapAppliedOutcome(
  intent: RouteIntent,
  result: Extract<RouteStoreApplyResult, { status: "applied" }>,
): RouteTransitionOutcome {
  if (result.view === "empty") {
    return {
      intentKey: intent.intentKey,
      noteId: undefined,
      requestSequence: undefined,
      status: "applied",
      surfaceEffect: "replaced",
      view: "empty",
    };
  }
  if (intent.noteId === undefined) {
    return mapFailedOutcome(intent, "store_apply_failed");
  }
  return {
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    requestSequence: result.requestSequence,
    status: "applied",
    surfaceEffect: "replaced",
    view: result.view,
  };
}

function coherentNoopOutcome(
  intent: RouteIntent,
  view: Extract<RouteStoreApplyResult, { status: "coherent_noop" }>["view"],
): RouteTransitionOutcome {
  if (intent.noteId === undefined) {
    return {
      intentKey: intent.intentKey,
      noteId: undefined,
      status: "coherent_noop",
      surfaceEffect: "retained",
      view: "empty",
    };
  }
  if (view === "empty") {
    return mapFailedOutcome(intent, "store_apply_failed");
  }
  return {
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    status: "coherent_noop",
    surfaceEffect: "retained",
    view,
  };
}

function mapFailedOutcome(
  intent: RouteIntent,
  reason: "note_read_failed" | "store_apply_failed",
): RouteTransitionOutcome {
  if (reason === "note_read_failed" && intent.noteId !== undefined) {
    return {
      intentKey: intent.intentKey,
      noteId: intent.noteId,
      reason,
      status: "failed",
      surfaceEffect: "replaced_by_error",
    };
  }
  return {
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    reason: "store_apply_failed",
    status: "failed",
    surfaceEffect: "retained",
  };
}
