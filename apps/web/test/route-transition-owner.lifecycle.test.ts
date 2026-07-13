import { describe, expect, it, vi } from "vitest";

import { createRouteGateRegistry } from "../src/routing/route-gate-registry.js";
import type { RouteNotesResult } from "../src/routing/route-store-executor.js";
import type {
  RouteGateResult,
  RouteTransitionGate,
} from "../src/routing/route-transition-types.js";
import {
  createDeferred,
  createRouteOwnerHarness,
  type RouteOwnerHarness,
} from "./route-transition-owner-test-helpers.js";
import { createTestRouteExecutor } from "./route-store-executor-test-helper.js";

describe("route owner navigation rejection", () => {
  it.each(["reject_before_echo", "reject_after_echo"] as const)(
    "settles %s without applying the rejected target",
    async (mode) => {
      const harness = createRouteOwnerHarness();
      const executor = createTestRouteExecutor();
      await settleInitialRoute(harness, executor);
      harness.setNavigationMode(mode);

      await expect(harness.owner.selectNote("b.md")).resolves.toMatchObject({
        noteId: "b.md",
        reason: "navigation_rejected",
        status: "failed",
      });
      expect(executor.applyRoute).toHaveBeenCalledOnce();
      expect(harness.entries()).toHaveLength(
        mode === "reject_before_echo" ? 1 : 2,
      );
    },
  );
});

describe("route owner disposal", () => {
  it("settles a held intent and its captured lease exactly once", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    const decision = createDeferred<RouteGateResult>();
    const prepare = vi.fn(() => decision.promise);
    const settle = vi.fn<RouteTransitionGate["settle"]>();
    harness.owner.registerGate({ prepare, settle });

    const selection = harness.owner.selectNote("b.md");
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledOnce();
    });
    harness.owner.dispose();

    await expect(selection).resolves.toMatchObject({
      noteId: "b.md",
      reason: "owner_disposed",
      status: "failed",
    });
    expect(settle).toHaveBeenCalledOnce();
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({
        surfaceEffect: "none",
        terminalStatus: "failed",
      }),
    );
    decision.resolve({ status: "continue" });
    await Promise.resolve();
    expect(settle).toHaveBeenCalledOnce();

    await expect(harness.owner.selectNote("c.md")).resolves.toMatchObject({
      reason: "owner_disposed",
      status: "failed",
    });
    expect(harness.navigateCount()).toBe(1);
  });

  it("lets an admitted call retain the executor captured before unregistration", async () => {
    const harness = createRouteOwnerHarness();
    harness.resolveCurrent();
    const notes = createDeferred<RouteNotesResult>();
    const heldEnsureNotes = vi.fn(() => notes.promise);
    const first = createTestRouteExecutor({ ensureNotes: heldEnsureNotes });
    const unregisterFirst = harness.owner.registerStoreExecutor(first.executor);
    await vi.waitFor(() => {
      expect(heldEnsureNotes).toHaveBeenCalledOnce();
    });
    unregisterFirst();
    notes.resolve({ noteIds: ["a.md", "b.md"], status: "ready" });
    await vi.waitFor(() => {
      expect(first.applyRoute).toHaveBeenCalledOnce();
    });

    const second = createTestRouteExecutor();
    harness.owner.registerStoreExecutor(second.executor);
    await expect(harness.owner.selectNote("b.md")).resolves.toMatchObject({
      noteId: "b.md",
      status: "applied",
    });
    expect(second.applyRoute).toHaveBeenCalledOnce();
    expect(first.applyRoute).toHaveBeenCalledOnce();
  });
});

describe("route gate registry identity", () => {
  it("settles captured capabilities after replacement and identity-safe unregistration", async () => {
    const registry = createRouteGateRegistry();
    const firstDecision = createDeferred<RouteGateResult>();
    const firstSettle = vi.fn<RouteTransitionGate["settle"]>();
    const unregisterFirst = registry.register({
      prepare: () => firstDecision.promise,
      settle: firstSettle,
    });
    const first = registry.prepare(createGateInput("lease-one"));
    const secondPrepare = vi.fn(() => ({ status: "continue" }) as const);
    const secondSettle = vi.fn<RouteTransitionGate["settle"]>();
    registry.register({ prepare: secondPrepare, settle: secondSettle });
    unregisterFirst();
    const second = registry.prepare(createGateInput("lease-two"));

    firstDecision.resolve({ status: "continue" });
    await expect(first.decision).resolves.toEqual({ status: "continue" });
    await expect(second.decision).resolves.toEqual({ status: "continue" });
    await first.settle(createSettlement("lease-one"));
    await second.settle(createSettlement("lease-two"));

    expect(firstSettle).toHaveBeenCalledOnce();
    expect(secondSettle).toHaveBeenCalledOnce();
    expect(secondPrepare).toHaveBeenCalledOnce();
  });

  it("contains thrown prepare and exact-once thrown settlement", async () => {
    const registry = createRouteGateRegistry();
    const settle = vi.fn<RouteTransitionGate["settle"]>(() => {
      throw new Error("Injected settle failure.");
    });
    registry.register({
      prepare: () => {
        throw new Error("Injected prepare failure.");
      },
      settle,
    });
    const prepared = registry.prepare(createGateInput("lease"));

    await expect(prepared.decision).resolves.toEqual({
      reason: "prerequisite_failed",
      status: "cancel",
    });
    await expect(prepared.settle(createSettlement("lease"))).resolves.toBe(
      undefined,
    );
    await prepared.settle(createSettlement("lease"));
    expect(settle).toHaveBeenCalledOnce();
  });
});

function createGateInput(leaseKey: string) {
  return { cause: "url_sync" as const, leaseKey, outgoingOwnerKey: undefined };
}

function createSettlement(leaseKey: string) {
  return {
    leaseKey,
    surfaceEffect: "retained" as const,
    terminalStatus: "cancelled" as const,
  };
}

async function settleInitialRoute(
  harness: RouteOwnerHarness,
  executor: ReturnType<typeof createTestRouteExecutor>,
): Promise<void> {
  harness.owner.registerStoreExecutor(executor.executor);
  harness.resolveCurrent();
  await vi.waitFor(() => {
    expect(executor.applyRoute).toHaveBeenCalledOnce();
  });
}
