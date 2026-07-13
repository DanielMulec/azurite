import { describe, expect, it, vi } from "vitest";

import type { RouteTransitionGate } from "../src/routing/route-transition-types.js";
import { createRouteTransitionQaController } from "../src/qa/route-transition-controller.js";
import { createLoadedStore } from "./note-browser-store-test-helpers.js";

describe("route transition QA controller holds", () => {
  it.each([
    {
      action: "continueHeld" as const,
      expected: { status: "continue" },
      state: "continue",
    },
    {
      action: "cancelHeld" as const,
      expected: { reason: "prerequisite_unavailable", status: "cancel" },
      state: "cancel",
    },
  ])("records one exact lease and resolves $state", async (input) => {
    const controller = createRouteTransitionQaController();
    const gate = controller.createRouteGate(
      createLoadedStore(),
      createContinueGate(),
    );
    controller.holdNext();

    const prepared = gate.prepare(createInput());
    await expectHolding(controller.getSnapshot);
    controller[input.action]();

    await expect(prepared).resolves.toEqual(input.expected);
    await gate.settle(createSettlement());
    expect(controller.getSnapshot()).toMatchObject({
      leaseKey: "qa-lease",
      outgoingOwnerKey: "rendered-owner",
      settlements: [createSettlement()],
      state: input.state,
    });
    controller.reset();
    expect(controller.getSnapshot()).toMatchObject({ state: "idle" });
  });
});

describe("route transition QA controller faults", () => {
  it("throws prepare only after the held lease is observable", async () => {
    const controller = createRouteTransitionQaController();
    const gate = controller.createRouteGate(
      createLoadedStore(),
      createContinueGate(),
    );
    controller.holdNext();

    const prepared = gate.prepare(createInput());
    await expectHolding(controller.getSnapshot);
    controller.throwHeldPrepare();

    await expect(prepared).rejects.toThrow("gate prepare failure");
    expect(controller.getSnapshot().state).toBe("throw_prepare");
  });

  it("throws settlement after allowing the chosen route outcome", async () => {
    const controller = createRouteTransitionQaController();
    const gate = controller.createRouteGate(
      createLoadedStore(),
      createContinueGate(),
    );
    controller.holdNext();

    const prepared = gate.prepare(createInput());
    await expectHolding(controller.getSnapshot);
    controller.throwHeldSettle();
    await expect(prepared).resolves.toEqual({ status: "continue" });

    await expect(gate.settle(createSettlement())).rejects.toThrow(
      "gate settlement failure",
    );
    expect(controller.getSnapshot()).toMatchObject({
      settlements: [createSettlement()],
      state: "throw_settle",
    });
  });

  it("fails exactly one traversal restoration confirmation", async () => {
    const controller = createRouteTransitionQaController();
    const gate = controller.createRouteGate(
      createLoadedStore(),
      createContinueGate(),
    );
    controller.failNextRestorationConfirmation();

    await expect(gate.prepare(createInput())).resolves.toEqual({
      reason: "prerequisite_failed",
      status: "cancel",
    });
    expect(controller.confirmRestoration()).toBe(false);
    expect(controller.confirmRestoration()).toBe(true);
    expect(controller.getSnapshot().state).toBe("fail_restore_confirmation");
  });
});

async function expectHolding(
  getSnapshot: () => { readonly state: string },
): Promise<void> {
  await vi.waitFor(() => {
    expect(getSnapshot().state).toBe("holding");
  });
}

function createInput() {
  return {
    cause: "note_list" as const,
    leaseKey: "qa-lease",
    outgoingOwnerKey: "rendered-owner",
  };
}

function createSettlement(): Parameters<RouteTransitionGate["settle"]>[0] {
  return {
    leaseKey: "qa-lease",
    surfaceEffect: "replaced",
    terminalStatus: "applied",
  };
}

function createContinueGate(): RouteTransitionGate {
  return {
    prepare: () => ({ status: "continue" }),
    settle: () => {},
  };
}
