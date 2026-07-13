import type {
  RouteGatePrepareInput,
  RouteGateResult,
  RouteGateSettlement,
  RouteTransitionGate,
} from "../routing/route-transition-types.js";
import { createBaselineRouteDraftGate } from "../state/baseline-route-draft-gate.js";
import type { NoteBrowserRouteGateFactory } from "../use-note-browser.js";

/** Ephemeral states exposed by the dedicated Slice 7C acceptance entry. */
export type RouteTransitionQaState =
  | "cancel"
  | "continue"
  | "fail_restore_confirmation"
  | "holding"
  | "idle"
  | "throw_prepare"
  | "throw_settle";

/** Observable non-persistent evidence for one injected transition case. */
export type RouteTransitionQaSnapshot = {
  readonly leaseKey: string | undefined;
  readonly outgoingOwnerKey: string | undefined;
  readonly settlements: readonly RouteGateSettlement[];
  readonly state: RouteTransitionQaState;
};

/** Browser and panel controls for the acceptance-only route gate. */
export type RouteTransitionQaController = {
  readonly cancelHeld: () => void;
  readonly confirmRestoration: () => boolean;
  readonly continueHeld: () => void;
  readonly createRouteGate: NoteBrowserRouteGateFactory;
  readonly failNextRestorationConfirmation: () => void;
  readonly getSnapshot: () => RouteTransitionQaSnapshot;
  readonly holdNext: () => void;
  readonly reset: () => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly throwHeldPrepare: () => void;
  readonly throwHeldSettle: () => void;
};

type HeldPrepare = {
  readonly reject: (error: Error) => void;
  readonly resolve: (result: RouteGateResult) => void;
};

type ControllerRuntime = {
  failRestoration: boolean;
  held: HeldPrepare | undefined;
  holdNext: boolean;
  readonly listeners: Set<() => void>;
  settlements: RouteGateSettlement[];
  snapshot: RouteTransitionQaSnapshot;
  throwSettle: boolean;
};

/** Creates one acceptance controller that never owns product route state. */
export function createRouteTransitionQaController(): RouteTransitionQaController {
  const runtime = createControllerRuntime();
  return {
    cancelHeld: () => resolveHeld(runtime, "cancel"),
    confirmRestoration: () => confirmRestoration(runtime),
    continueHeld: () => resolveHeld(runtime, "continue"),
    createRouteGate: (store) =>
      createControlledGate(createBaselineRouteDraftGate(store), runtime),
    failNextRestorationConfirmation: () => {
      runtime.failRestoration = true;
      updateState(runtime, "fail_restore_confirmation");
    },
    getSnapshot: () => runtime.snapshot,
    holdNext: () => {
      runtime.holdNext = true;
      resetEvidence(runtime);
    },
    reset: () => resetRuntime(runtime),
    subscribe: (listener) => subscribe(runtime, listener),
    throwHeldPrepare: () => rejectHeldPrepare(runtime),
    throwHeldSettle: () => resolveHeld(runtime, "throw_settle"),
  };
}

function createControllerRuntime(): ControllerRuntime {
  return {
    failRestoration: false,
    held: undefined,
    holdNext: false,
    listeners: new Set(),
    settlements: [],
    snapshot: createSnapshot("idle", undefined, undefined, []),
    throwSettle: false,
  };
}

function createControlledGate(
  baseline: RouteTransitionGate,
  runtime: ControllerRuntime,
): RouteTransitionGate {
  return {
    prepare: async (input) => {
      await baseline.prepare(input);
      return await prepareControlledGate(input, runtime);
    },
    settle: async (settlement) => {
      await baseline.settle(settlement);
      settleControlledGate(settlement, runtime);
    },
  };
}

function prepareControlledGate(
  input: RouteGatePrepareInput,
  runtime: ControllerRuntime,
): ReturnType<RouteTransitionGate["prepare"]> {
  if (runtime.failRestoration) {
    captureInput(input, "fail_restore_confirmation", runtime);
    return { reason: "prerequisite_failed", status: "cancel" };
  }
  if (!runtime.holdNext) {
    return { status: "continue" };
  }
  runtime.holdNext = false;
  captureInput(input, "holding", runtime);
  return new Promise((resolve, reject) => {
    runtime.held = { reject, resolve };
  });
}

function resolveHeld(
  runtime: ControllerRuntime,
  state: "cancel" | "continue" | "throw_settle",
): void {
  const held = runtime.held;
  if (held === undefined) {
    return;
  }
  runtime.held = undefined;
  runtime.throwSettle = state === "throw_settle";
  updateState(runtime, state);
  held.resolve(getHeldResult(state));
}

function getHeldResult(
  state: "cancel" | "continue" | "throw_settle",
): RouteGateResult {
  return state === "cancel"
    ? { reason: "prerequisite_failed", status: "cancel" }
    : { status: "continue" };
}

function rejectHeldPrepare(runtime: ControllerRuntime): void {
  const held = runtime.held;
  if (held === undefined) {
    return;
  }
  runtime.held = undefined;
  updateState(runtime, "throw_prepare");
  held.reject(new Error("Injected Slice 7C gate prepare failure."));
}

function settleControlledGate(
  settlement: RouteGateSettlement,
  runtime: ControllerRuntime,
): void {
  runtime.settlements = [...runtime.settlements, settlement];
  publish(runtime);
  if (runtime.throwSettle) {
    runtime.throwSettle = false;
    throw new Error("Injected Slice 7C gate settlement failure.");
  }
}

function confirmRestoration(runtime: ControllerRuntime): boolean {
  if (!runtime.failRestoration) {
    return true;
  }
  runtime.failRestoration = false;
  return false;
}

function captureInput(
  input: RouteGatePrepareInput,
  state: RouteTransitionQaState,
  runtime: ControllerRuntime,
): void {
  runtime.snapshot = createSnapshot(
    state,
    input.leaseKey,
    input.outgoingOwnerKey,
    runtime.settlements,
  );
  notify(runtime);
}

function updateState(
  runtime: ControllerRuntime,
  state: RouteTransitionQaState,
): void {
  runtime.snapshot = { ...runtime.snapshot, state };
  notify(runtime);
}

function publish(runtime: ControllerRuntime): void {
  runtime.snapshot = { ...runtime.snapshot, settlements: runtime.settlements };
  notify(runtime);
}

function resetRuntime(runtime: ControllerRuntime): void {
  runtime.held?.resolve({
    reason: "prerequisite_failed",
    status: "cancel",
  });
  runtime.failRestoration = false;
  runtime.held = undefined;
  runtime.holdNext = false;
  runtime.throwSettle = false;
  resetEvidence(runtime);
}

function resetEvidence(runtime: ControllerRuntime): void {
  runtime.settlements = [];
  runtime.snapshot = createSnapshot("idle", undefined, undefined, []);
  notify(runtime);
}

function createSnapshot(
  state: RouteTransitionQaState,
  leaseKey: string | undefined,
  outgoingOwnerKey: string | undefined,
  settlements: readonly RouteGateSettlement[],
): RouteTransitionQaSnapshot {
  return { leaseKey, outgoingOwnerKey, settlements, state };
}

function subscribe(runtime: ControllerRuntime, listener: () => void): () => void {
  runtime.listeners.add(listener);
  return () => {
    runtime.listeners.delete(listener);
  };
}

function notify(runtime: ControllerRuntime): void {
  for (const listener of runtime.listeners) {
    listener();
  }
}
