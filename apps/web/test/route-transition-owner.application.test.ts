import { describe, expect, it, vi } from "vitest";

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

describe("route owner application confirmation", () => {
  it("waits for exact router resolution after an early navigation promise", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    harness.setNavigationMode("resolve_before_router");

    const selection = harness.owner.selectNote("b.md");
    await vi.waitFor(() => {
      expect(harness.current().href).toBe("/?note=b.md");
    });
    expect(executor.applyRoute).toHaveBeenCalledOnce();

    harness.resolveHeldNavigation();
    await expect(selection).resolves.toMatchObject({
      noteId: "b.md",
      status: "applied",
    });
    expect(executor.applyRoute).toHaveBeenCalledTimes(2);
  });

  it("joins a repeated click while its exact gate lease is pending", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    const decision = createDeferred<RouteGateResult>();
    const prepare = vi.fn(() => decision.promise);
    const settle = vi.fn();
    harness.owner.registerGate({ prepare, settle });

    const first = harness.owner.selectNote("b.md");
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledOnce();
    });
    const second = harness.owner.selectNote("b.md");
    expect(harness.navigateCount()).toBe(1);
    expect(prepare).toHaveBeenCalledOnce();

    decision.resolve({ status: "continue" });
    const [firstOutcome, secondOutcome] = await Promise.all([first, second]);
    expect(secondOutcome.intentKey).toBe(firstOutcome.intentKey);
    expect(executor.applyRoute).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenCalledOnce();
    expect(harness.entries()).toHaveLength(2);
  });
});

describe("route owner same-target policy", () => {
  it("returns a coherent no-op without navigation, gate, or store work", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    executor.getCoherentView.mockReturnValue({
      status: "coherent_noop",
      view: "ready",
    });
    const prepare = vi.fn<RouteTransitionGate["prepare"]>(() => ({
      status: "continue",
    }));
    harness.owner.registerGate({ prepare, settle: vi.fn() });

    await expect(harness.owner.selectNote("a.md")).resolves.toMatchObject({
      noteId: "a.md",
      status: "coherent_noop",
      view: "ready",
    });
    expect(harness.navigateCount()).toBe(0);
    expect(prepare).not.toHaveBeenCalled();
    expect(executor.applyRoute).toHaveBeenCalledOnce();
  });

  it("reconciles an incoherent current URL in place without a duplicate entry", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    const prepare = vi.fn(() => ({ status: "continue" }) as const);
    harness.owner.registerGate({ prepare, settle: vi.fn() });

    await expect(harness.owner.selectNote("a.md")).resolves.toMatchObject({
      noteId: "a.md",
      status: "applied",
    });
    expect(harness.navigateCount()).toBe(0);
    expect(harness.entries()).toHaveLength(1);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ outgoingOwnerKey: "rendered-a-session" }),
    );
    expect(executor.applyRoute).toHaveBeenCalledTimes(2);
  });
});

describe("route owner startup and repeated-occurrence behavior", () => {
  it("coalesces startup fallback into one replacement and one note application", async () => {
    const harness = createRouteOwnerHarness({
      entries: ["/?azurite-dev=sentry-test#focus"],
    });
    const executor = createTestRouteExecutor();
    executor.ensureNotes.mockResolvedValue({
      noteIds: ["first.md", "second.md"],
      status: "ready",
    });
    harness.owner.registerStoreExecutor(executor.executor);
    harness.resolveCurrent();

    await vi.waitFor(() => {
      expect(executor.applyRoute).toHaveBeenCalledOnce();
    });
    expect(harness.navigations()).toEqual([
      expect.objectContaining({
        href: "/?note=first.md&azurite-dev=sentry-test#focus",
        replace: true,
      }),
    ]);
    expect(executor.applyRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: "startup_fallback",
        noteId: "first.md",
      }),
    );
    expect(harness.entries()).toHaveLength(1);
  });

  it("treats stored same-note history occurrences as independent intents", async () => {
    const harness = createRouteOwnerHarness({
      entries: ["/?note=a.md", "/?note=b.md", "/?note=a.md"],
      initialIndex: 2,
    });
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);

    await harness.traverse(-2);
    await vi.waitFor(() => {
      expect(executor.applyRoute).toHaveBeenCalledTimes(2);
    });
    expectIndependentSameNoteOccurrences(executor.applyRoute.mock.calls);
  });
});

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

function expectIndependentSameNoteOccurrences(
  calls: ReturnType<
    typeof createTestRouteExecutor
  >["applyRoute"]["mock"]["calls"],
): void {
  const inputs = calls.map(([input]) => input);
  expect(inputs.map(({ noteId }) => noteId)).toEqual(["a.md", "a.md"]);
  expect(inputs.map(({ authorization }) => authorization.intentKey)).toEqual([
    expect.any(String),
    expect.any(String),
  ]);
  expect(
    new Set(inputs.map(({ authorization }) => authorization.intentKey)).size,
  ).toBe(2);
  expect(new Set(inputs.map(({ location }) => location.historyKey)).size).toBe(
    2,
  );
}
