import type { RouteHistoryAdmission } from "./route-history-admission.js";
import { gateLeaseKey } from "./route-intent-outcomes.js";
import {
  nextRuntimeIdentity,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type { RouteTransitionOutcome } from "./route-transition-types.js";

/** Tears down one owner and settles every outstanding caller and gate lease. */
export function disposeRouteTransitionOwner(
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
  resolveLocationConfirmations(runtime);
  settleActiveOnDisposal(runtime);
  runtime.storeRegistry.dispose();
  settlePendingOnDisposal(runtime);
  runtime.currentIntentKey = undefined;
}

/** Returns the terminal result for selection attempted after owner disposal. */
export function ownerDisposedSelection(
  noteId: string,
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  return ownerDisposedOutcome(nextRuntimeIdentity(runtime, "intent"), noteId);
}

function resolveLocationConfirmations(runtime: RouteTransitionRuntime): void {
  for (const confirmation of runtime.locationConfirmations.values()) {
    confirmation.result.resolve(undefined);
  }
  runtime.locationConfirmations.clear();
}

function settleActiveOnDisposal(runtime: RouteTransitionRuntime): void {
  for (const intent of runtime.activeIntents.values()) {
    intent.settled = true;
    const outcome = ownerDisposedOutcome(intent.intentKey, intent.noteId);
    if (intent.gate !== undefined) {
      void intent.gate.settle({
        leaseKey: gateLeaseKey(intent.intentKey),
        surfaceEffect: outcome.surfaceEffect,
        terminalStatus: outcome.status,
      });
    }
    intent.result.resolve(outcome);
  }
  runtime.activeIntents.clear();
}

function settlePendingOnDisposal(runtime: RouteTransitionRuntime): void {
  for (const pending of runtime.pendingApplications.values()) {
    pending.result.resolve(
      ownerDisposedOutcome(pending.intentKey, pending.noteId),
    );
  }
  runtime.pendingApplications.clear();
}

function ownerDisposedOutcome(
  intentKey: string,
  noteId: string | undefined,
): RouteTransitionOutcome {
  return {
    intentKey,
    noteId,
    reason: "owner_disposed",
    status: "failed",
    surfaceEffect: "none",
  };
}
