import { startApplicationNavigation } from "./route-application-navigation.js";
import type { PreparedRouteGate } from "./route-gate-registry.js";
import {
  completeRouteIntent,
  mapStoreOutcome,
  supersededOutcome,
} from "./route-intent-outcomes.js";
import type {
  RouteStoreExecutor,
  RouteStoreApplyResult,
  RouteNotesResult,
} from "./route-store-executor.js";
import {
  isCurrentIntent,
  type RouteIntent,
  type RouteTransitionRouterAdapter,
  type RouteTransitionRuntime,
} from "./route-transition-runtime.js";
import type { RouteTransitionOutcome } from "./route-transition-types.js";

type ExecutionInput = {
  readonly confirmation: Promise<void>;
  readonly gate: PreparedRouteGate;
  readonly intent: RouteIntent;
};

type ExecutionDependencies = {
  readonly router: RouteTransitionRouterAdapter;
  readonly runtime: RouteTransitionRuntime;
};

/** Completes an admitted intent after exact location and store readiness. */
export async function executeAdmittedRouteIntent(
  input: ExecutionInput,
  dependencies: ExecutionDependencies,
): Promise<void> {
  await input.confirmation;
  if (await completeIfNotCurrent(input, "awaiting_location", dependencies)) {
    return;
  }
  await executeAfterLocation(input, dependencies);
}

async function executeAfterLocation(
  input: ExecutionInput,
  dependencies: ExecutionDependencies,
): Promise<void> {
  const executor = await dependencies.runtime.storeRegistry.wait();
  if (await completeAfterExecutorWait(input, executor, dependencies)) {
    return;
  }
  await executeWithExecutor(input, requireExecutor(executor), dependencies);
}

async function executeWithExecutor(
  input: ExecutionInput,
  executor: RouteStoreExecutor,
  dependencies: ExecutionDependencies,
): Promise<void> {
  const notes = await executor.ensureNotes();
  if (await completeAfterNotesWait(input, notes, dependencies)) {
    return;
  }
  if (redirectUndefinedTarget(input.intent, notes, dependencies)) {
    await completeRouteIntent(
      {
        gate: input.gate,
        intent: input.intent,
        outcome: supersededOutcome(input.intent, "awaiting_notes"),
      },
      dependencies.runtime,
    );
    return;
  }
  const result = await applyRoute(input.intent, executor);
  const outcome = selectStoreOutcome(input.intent, result, dependencies.runtime);
  await completeRouteIntent(
    { gate: input.gate, intent: input.intent, outcome },
    dependencies.runtime,
  );
}

async function completeIfNotCurrent(
  input: ExecutionInput,
  phase: Extract<RouteTransitionOutcome, { status: "superseded" }>["phase"],
  dependencies: ExecutionDependencies,
): Promise<boolean> {
  const outcome = getNonCurrentOutcome(input.intent, phase, dependencies.runtime);
  if (outcome === undefined) {
    return false;
  }
  await completeRouteIntent(
    { gate: input.gate, intent: input.intent, outcome },
    dependencies.runtime,
  );
  return true;
}

async function completeAfterExecutorWait(
  input: ExecutionInput,
  executor: RouteStoreExecutor | undefined,
  dependencies: ExecutionDependencies,
): Promise<boolean> {
  if (executor === undefined) {
    await completeRouteIntent(
      {
        gate: input.gate,
        intent: input.intent,
        outcome: ownerDisposedOutcome(input.intent),
      },
      dependencies.runtime,
    );
    return true;
  }
  executor.activateRouteIntent(input.intent.intentKey);
  return await completeIfNotCurrent(
    input,
    "awaiting_executor",
    dependencies,
  );
}

async function completeAfterNotesWait(
  input: ExecutionInput,
  notes: RouteNotesResult,
  dependencies: ExecutionDependencies,
): Promise<boolean> {
  if (await completeIfNotCurrent(input, "awaiting_notes", dependencies)) {
    return true;
  }
  if (notes.status === "ready") {
    return false;
  }
  await completeRouteIntent(
    {
      gate: input.gate,
      intent: input.intent,
      outcome: notesFailedOutcome(input.intent),
    },
    dependencies.runtime,
  );
  return true;
}

function redirectUndefinedTarget(
  intent: RouteIntent,
  notes: RouteNotesResult,
  dependencies: ExecutionDependencies,
): boolean {
  if (cannotRedirectUndefinedTarget(intent, notes)) {
    return false;
  }
  const firstNoteId = firstReadyNoteId(notes);
  if (firstNoteId === undefined) {
    return redirectCanonicalEmpty(intent, dependencies);
  }
  startStartupReplacement(firstNoteId, dependencies);
  return true;
}

function firstReadyNoteId(notes: RouteNotesResult): string | undefined {
  return notes.status === "ready" ? notes.noteIds[0] : undefined;
}

function cannotRedirectUndefinedTarget(
  intent: RouteIntent,
  notes: RouteNotesResult,
): boolean {
  return intent.noteId !== undefined || notes.status !== "ready";
}

function startStartupReplacement(
  noteId: string,
  dependencies: ExecutionDependencies,
): void {
  void startApplicationNavigation(
    {
      cause: "startup_fallback",
      kind: "startup_replace",
      noteId,
    },
    dependencies,
  );
}

function redirectCanonicalEmpty(
  intent: RouteIntent,
  dependencies: ExecutionDependencies,
): boolean {
  if (!intent.needsCanonicalReplacement) {
    return false;
  }
  void startApplicationNavigation(
    { cause: "url_sync", kind: "canonical_replace", noteId: undefined },
    dependencies,
  );
  return true;
}

async function applyRoute(
  intent: RouteIntent,
  executor: RouteStoreExecutor,
): Promise<RouteStoreApplyResult> {
  try {
    return await executor.applyRoute({
      authorization: {
        authorizationKey: nextRuntimeIdentityForIntent(intent),
        intentKey: intent.intentKey,
        kind: "route_intent",
      },
      cause: intent.cause,
      location: intent.location,
      noteId: intent.noteId,
    });
  } catch {
    return { reason: "store_apply_failed", status: "failed" };
  }
}

function nextRuntimeIdentityForIntent(intent: RouteIntent): string {
  return `${intent.intentKey}:authorization`;
}

function selectStoreOutcome(
  intent: RouteIntent,
  result: RouteStoreApplyResult,
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome {
  return isCurrentIntent(intent, runtime)
    ? mapStoreOutcome(intent, result)
    : supersededOutcome(intent, "awaiting_read");
}

function getNonCurrentOutcome(
  intent: RouteIntent,
  phase: Extract<RouteTransitionOutcome, { status: "superseded" }>["phase"],
  runtime: RouteTransitionRuntime,
): RouteTransitionOutcome | undefined {
  if (runtime.disposed) {
    return ownerDisposedOutcome(intent);
  }
  return isCurrentIntent(intent, runtime)
    ? undefined
    : supersededOutcome(intent, phase);
}

function requireExecutor(
  executor: RouteStoreExecutor | undefined,
): RouteStoreExecutor {
  if (executor === undefined) {
    throw new Error("Route store executor was disposed.");
  }
  return executor;
}

function ownerDisposedOutcome(intent: RouteIntent): RouteTransitionOutcome {
  return {
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    reason: "owner_disposed",
    status: "failed",
    surfaceEffect: "none",
  };
}

function notesFailedOutcome(intent: RouteIntent): RouteTransitionOutcome {
  return {
    intentKey: intent.intentKey,
    noteId: intent.noteId,
    reason: "notes_list_failed",
    status: "failed",
    surfaceEffect: "retained",
  };
}
