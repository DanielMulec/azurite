import type {
  RouteGatePrepareInput,
  RouteGateResult,
  RouteGateSettlement,
  RouteTransitionGate,
} from "./route-transition-types.js";

/** One captured gate call that retains its originating capability. */
export type PreparedRouteGate = {
  readonly result: RouteGateResult;
  readonly settle: (settlement: RouteGateSettlement) => Promise<void>;
};

/** Replaceable target-free gate registry with identity-safe unregistration. */
export type RouteGateRegistry = {
  readonly prepare: (input: RouteGatePrepareInput) => Promise<PreparedRouteGate>;
  readonly register: (gate: RouteTransitionGate) => () => void;
};

const noOpGate: RouteTransitionGate = Object.freeze({
  prepare: (): RouteGateResult => ({ status: "continue" }),
  settle: () => {},
});

/** Creates the runtime gate slot owned by one route-transition owner. */
export function createRouteGateRegistry(): RouteGateRegistry {
  let currentGate = noOpGate;

  return {
    prepare: async (input) => await prepareGate(currentGate, input),
    register: (gate) => {
      currentGate = gate;
      return () => {
        if (currentGate === gate) {
          currentGate = noOpGate;
        }
      };
    },
  };
}

async function prepareGate(
  gate: RouteTransitionGate,
  input: RouteGatePrepareInput,
): Promise<PreparedRouteGate> {
  const result = await callPrepare(gate, input);
  let didSettle = false;

  return {
    result,
    settle: async (settlement) => {
      if (didSettle) {
        return;
      }
      didSettle = true;
      try {
        await gate.settle(settlement);
      } catch {
        // Gate settlement observes a decided outcome and cannot change it.
      }
    },
  };
}

async function callPrepare(
  gate: RouteTransitionGate,
  input: RouteGatePrepareInput,
): Promise<RouteGateResult> {
  try {
    return await gate.prepare(input);
  } catch {
    return { reason: "prerequisite_failed", status: "cancel" };
  }
}
