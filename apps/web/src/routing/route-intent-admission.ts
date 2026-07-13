import { consumePendingApplication } from "./route-application-navigation.js";
import type { PreparedRouteGate } from "./route-gate-registry.js";
import type { HistoryAdmissionCandidate } from "./route-history-admission.js";
import { executeAdmittedRouteIntent } from "./route-intent-execution.js";
import {
  completeRouteIntent,
  gateLeaseKey,
  supersededOutcome,
} from "./route-intent-outcomes.js";
import { registerLocationConfirmation } from "./route-location-confirmation.js";
import {
  createControlledResult,
  isCurrentIntent,
  nextRuntimeIdentity,
  type PendingApplicationNavigation,
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
import {
  needsCanonicalReplacement,
  readApplicationNavigationToken,
  toTraversalNavigationKind,
  validateLocationOccurrence,
} from "./validated-route-location.js";

type AdmissionDependencies = {
  readonly router: RouteTransitionRouterAdapter;
  readonly runtime: RouteTransitionRuntime;
};

type PreparedAdmission = {
  readonly gate: PreparedRouteGate;
  readonly intent: RouteIntent;
};

/** Converts one TanStack blocker occurrence into an owned route intent. */
export async function admitHistoryCandidate(
  candidate: HistoryAdmissionCandidate,
  dependencies: AdmissionDependencies,
): Promise<{ readonly block: boolean }> {
  const intent = createHistoryIntent(candidate, dependencies.runtime);
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
  },
  dependencies: AdmissionDependencies,
): Promise<RouteTransitionOutcome> {
  const intent = createIntent(input, dependencies.runtime);
  registerIntent(intent, dependencies.runtime);
  void prepareCurrentAdmission(intent, input.confirmation, dependencies);
  return intent.result.promise;
}

function createHistoryIntent(
  candidate: HistoryAdmissionCandidate,
  runtime: RouteTransitionRuntime,
): RouteIntent | undefined {
  runtime.generation += 1;
  const location = validateLocationOccurrence(
    candidate.nextLocation,
    runtime.generation,
  );
  if (isApplicationAction(candidate.action)) {
    return createApplicationEchoIntent(candidate, location, runtime);
  }
  return createTraversalIntent(candidate, location, runtime);
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
  if (pending === undefined) {
    return undefined;
  }
  return bindPendingIntent(pending, candidate, location, runtime);
}

function bindPendingIntent(
  pending: PendingApplicationNavigation,
  candidate: HistoryAdmissionCandidate,
  location: ValidatedLocationOccurrence,
  runtime: RouteTransitionRuntime,
): RouteIntent {
  const intent: RouteIntent = {
    ...pending,
    location,
    needsCanonicalReplacement: needsCanonicalReplacement(
      candidate.nextLocation,
      location,
    ),
    settled: false,
  };
  registerIntent(intent, runtime);
  return intent;
}

function createTraversalIntent(
  candidate: HistoryAdmissionCandidate,
  location: ValidatedLocationOccurrence,
  runtime: RouteTransitionRuntime,
): RouteIntent {
  const intent = createIntent(
    {
      cause: "url_sync",
      kind: toTraversalNavigationKind(requireTraversalAction(candidate.action)),
      location,
      needsCanonicalReplacement: needsCanonicalReplacement(
        candidate.nextLocation,
        location,
      ),
      noteId: location.search.note,
    },
    runtime,
  );
  registerIntent(intent, runtime);
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

function createIntent(
  input: {
    readonly cause: RouteGateCause;
    readonly intentKey?: string;
    readonly kind: RouteNavigationKind;
    readonly location: ValidatedLocationOccurrence;
    readonly needsCanonicalReplacement: boolean;
    readonly noteId: string | undefined;
  },
  runtime: RouteTransitionRuntime,
): RouteIntent {
  return {
    ...input,
    intentKey: input.intentKey ?? nextRuntimeIdentity(runtime, "intent"),
    result: createControlledResult<RouteTransitionOutcome>(),
    settled: false,
  };
}

function registerIntent(
  intent: RouteIntent,
  runtime: RouteTransitionRuntime,
): void {
  runtime.currentIntentKey = intent.intentKey;
  runtime.activeIntents.set(intent.intentKey, intent);
  runtime.storeRegistry.get()?.activateRouteIntent(intent.intentKey);
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
  if (prepared.gate.result.status === "cancel") {
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
  if (prepared.gate.result.status === "cancel") {
    await completeRouteIntent(
      {
        gate: prepared.gate,
        intent,
        outcome: cancellationOutcome(intent, prepared.gate.result, "not_needed"),
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
  const gate = await runtime.gateRegistry.prepare({
    cause: intent.cause,
    leaseKey: gateLeaseKey(intent.intentKey),
    outgoingOwnerKey: runtime.storeRegistry.get()?.getRenderedOwnerKey(),
  });
  return { gate, intent };
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
          prepared.gate.result,
          "entry_not_committed",
        ),
      },
      runtime,
    );
    return;
  }
  const confirmed = await input.candidate.restoration;
  await finishTraversalCancellation(input.intent, prepared, confirmed, runtime);
}

async function finishTraversalCancellation(
  intent: RouteIntent,
  prepared: PreparedAdmission,
  confirmed: boolean,
  runtime: RouteTransitionRuntime,
): Promise<void> {
  const outcome = getTraversalCancellationOutcome(
    intent,
    prepared.gate.result,
    confirmed,
    runtime,
  );
  if (outcome.status === "failed") {
    runtime.storeRegistry.get()?.reportHistoryUnavailable();
  }
  await completeRouteIntent({ gate: prepared.gate, intent, outcome }, runtime);
}

function getTraversalCancellationOutcome(
  intent: RouteIntent,
  result: RouteGateResult,
  confirmed: boolean,
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  if (!isCurrentIntent(intent, runtime)) {
    return supersededOutcome(intent, "awaiting_history_restore");
  }
  if (!confirmed) {
    return historyRestoreFailedOutcome(intent);
  }
  return cancellationOutcome(intent, result, "traversal_restored");
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

function isApplicationAction(
  action: HistoryAdmissionCandidate["action"],
): boolean {
  return action === "PUSH" || action === "REPLACE";
}
