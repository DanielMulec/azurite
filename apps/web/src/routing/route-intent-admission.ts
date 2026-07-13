import type { PreparedRouteGate } from "./route-gate-registry.js";
import type { HistoryAdmissionCandidate } from "./route-history-admission.js";
import {
  createCurrentRouteIntent,
  createHistoryRouteIntent,
  registerRouteIntent,
} from "./route-intent-creation.js";
import { executeAdmittedRouteIntent } from "./route-intent-execution.js";
import {
  completeRouteIntent,
  gateLeaseKey,
  supersededOutcome,
} from "./route-intent-outcomes.js";
import { registerLocationConfirmation } from "./route-location-confirmation.js";
import { getRenderedOwnerKeySafely } from "./route-store-executor.js";
import {
  isCurrentIntent,
  type RouteIntent,
  type RouteTransitionRouterAdapter,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type {
  RouteGateCause,
  RouteGateResult,
  RouteNavigationKind,
  RouteTransitionOutcome,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";

type AdmissionDependencies = {
  readonly router: RouteTransitionRouterAdapter;
  readonly runtime: RouteTransitionRuntime;
};

type PreparedAdmission = {
  readonly gate: PreparedRouteGate;
  readonly intent: RouteIntent;
  readonly result: RouteGateResult;
};

/** Converts one TanStack blocker occurrence into an owned route intent. */
export async function admitHistoryCandidate(
  candidate: HistoryAdmissionCandidate,
  dependencies: AdmissionDependencies,
): Promise<{ readonly block: boolean }> {
  const intent = createHistoryRouteIntent(candidate, dependencies.runtime);
  if (intent === undefined) {
    return { block: true };
  }
  const confirmation = registerLocationConfirmation(
    intent.location,
    { historySeen: false, resolvedSeen: false },
    dependencies.runtime,
  );
  return await prepareHistoryAdmission(
    { candidate, confirmation, intent },
    dependencies,
  );
}

/** Admits the seeded or in-place current occurrence without history mutation. */
export function admitCurrentOccurrence(
  input: {
    readonly cause: RouteGateCause;
    readonly confirmation: Promise<void>;
    readonly intentKey?: string;
    readonly kind: RouteNavigationKind;
    readonly location: ValidatedLocationOccurrence;
    readonly needsCanonicalReplacement: boolean;
    readonly noteId: string | undefined;
    readonly suppressStartupFallback?: boolean;
  },
  dependencies: AdmissionDependencies,
): Promise<RouteTransitionOutcome> {
  const intent = createCurrentRouteIntent(input, dependencies.runtime);
  registerRouteIntent(intent, dependencies.runtime);
  void prepareCurrentAdmission(intent, input.confirmation, dependencies);
  return intent.result.promise;
}

async function prepareHistoryAdmission(
  input: {
    readonly candidate: HistoryAdmissionCandidate;
    readonly confirmation: Promise<void>;
    readonly intent: RouteIntent;
  },
  dependencies: AdmissionDependencies,
): Promise<{ readonly block: boolean }> {
  const prepared = await prepareGate(input.intent, dependencies.runtime);
  if (!isCurrentIntent(input.intent, dependencies.runtime)) {
    void finishBlockedStale(input, prepared, dependencies.runtime);
    return { block: true };
  }
  if (prepared.result.status === "cancel") {
    void finishCancellation(input, prepared, dependencies.runtime);
    return { block: true };
  }
  void executeAdmittedRouteIntent(
    {
      confirmation: input.confirmation,
      gate: prepared.gate,
      intent: input.intent,
    },
    dependencies,
  );
  return { block: false };
}

async function prepareCurrentAdmission(
  intent: RouteIntent,
  confirmation: Promise<void>,
  dependencies: AdmissionDependencies,
): Promise<void> {
  const prepared = await prepareGate(intent, dependencies.runtime);
  if (!isCurrentIntent(intent, dependencies.runtime)) {
    await completeRouteIntent(
      {
        gate: prepared.gate,
        intent,
        outcome: supersededOutcome(intent, "awaiting_gate"),
      },
      dependencies.runtime,
    );
    return;
  }
  if (prepared.result.status === "cancel") {
    await completeRouteIntent(
      {
        gate: prepared.gate,
        intent,
        outcome: cancellationOutcome(intent, prepared.result, "not_needed"),
      },
      dependencies.runtime,
    );
    return;
  }
  await executeAdmittedRouteIntent(
    { confirmation, gate: prepared.gate, intent },
    dependencies,
  );
}

async function prepareGate(
  intent: RouteIntent,
  runtime: RouteTransitionRuntime,
): Promise<PreparedAdmission> {
  const gate = runtime.gateRegistry.prepare({
    cause: intent.cause,
    leaseKey: gateLeaseKey(intent.intentKey),
    outgoingOwnerKey: getRenderedOwnerKeySafely(runtime.storeRegistry.get()),
  });
  intent.gate = gate;
  const result = await gate.decision;
  return { gate, intent, result };
}

async function finishBlockedStale(
  input: {
    readonly candidate: HistoryAdmissionCandidate;
    readonly intent: RouteIntent;
  },
  prepared: PreparedAdmission,
  runtime: RouteTransitionRuntime,
): Promise<void> {
  await input.candidate.restoration;
  await completeRouteIntent(
    {
      gate: prepared.gate,
      intent: input.intent,
      outcome: supersededOutcome(input.intent, "awaiting_gate"),
    },
    runtime,
  );
}

async function finishCancellation(
  input: {
    readonly candidate: HistoryAdmissionCandidate;
    readonly intent: RouteIntent;
  },
  prepared: PreparedAdmission,
  runtime: RouteTransitionRuntime,
): Promise<void> {
  if (input.candidate.restoration === undefined) {
    await completeRouteIntent(
      {
        gate: prepared.gate,
        intent: input.intent,
        outcome: cancellationOutcome(
          input.intent,
          prepared.result,
          "entry_not_committed",
        ),
      },
      runtime,
    );
    return;
  }
  const confirmed = await input.candidate.restoration;
  await finishTraversalCancellation(
    { confirmed, intent: input.intent, prepared },
    runtime,
  );
}

async function finishTraversalCancellation(
  input: {
    readonly confirmed: boolean;
    readonly intent: RouteIntent;
    readonly prepared: PreparedAdmission;
  },
  runtime: RouteTransitionRuntime,
): Promise<void> {
  const outcome = getTraversalCancellationOutcome(input, runtime);
  if (outcome.status === "failed") {
    reportHistoryUnavailable(runtime);
  }
  await completeRouteIntent(
    { gate: input.prepared.gate, intent: input.intent, outcome },
    runtime,
  );
}

function reportHistoryUnavailable(runtime: RouteTransitionRuntime): void {
  try {
    runtime.storeRegistry.get()?.reportHistoryUnavailable();
  } catch {
    // Visible degradation is best effort; the route outcome must still settle.
  }
}

function getTraversalCancellationOutcome(
  input: {
    readonly confirmed: boolean;
    readonly intent: RouteIntent;
    readonly prepared: PreparedAdmission;
  },
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  if (!isCurrentIntent(input.intent, runtime)) {
    return supersededOutcome(input.intent, "awaiting_history_restore");
  }
  if (!input.confirmed) {
    return historyRestoreFailedOutcome(input.intent);
  }
  return cancellationOutcome(
    input.intent,
    input.prepared.result,
    "traversal_restored",
  );
}

function cancellationOutcome(
  intent: RouteIntent,
  result: RouteGateResult,
  historyEffect: "entry_not_committed" | "not_needed" | "traversal_restored",
): RouteTransitionOutcome {
  const reason =
    result.status === "cancel" ? result.reason : "prerequisite_failed";
  return {
    historyEffect,
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    reason,
    status: "cancelled",
    surfaceEffect: "retained",
  };
}

function historyRestoreFailedOutcome(
  intent: RouteIntent,
): RouteTransitionOutcome {
  return {
    degradation: "route_history_unavailable",
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    reason: "history_restore_failed",
    status: "failed",
    surfaceEffect: "retained",
  };
}
