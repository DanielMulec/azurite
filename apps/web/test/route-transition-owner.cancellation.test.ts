import { describe, expect, it, vi } from "vitest";

import type {
  RouteGateResult,
  RouteTransitionGate,
} from "../src/routing/route-transition-types.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred as createStoreDeferred,
  createNote,
  createSeededStore,
  readyClusterIdentity,
} from "./note-browser-store-test-helpers.js";
import {
  createDeferred,
  createRouteOwnerHarness,
  type RouteOwnerHarness,
} from "./route-transition-owner-test-helpers.js";
import { createTestRouteExecutor } from "./route-store-executor-test-helper.js";

describe("route owner pending-predecessor cancellation", () => {
  it("preserves a pending predecessor read when the candidate gate cancels", async () => {
    const aRead = createStoreDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi
      .fn<NoteBrowserApi["readNote"]>()
      .mockImplementation(() => aRead.promise);
    const store = createSeededStore({ api: createApi({ readNote }) });
    const harness = createRouteOwnerHarness({ entries: ["/?note=index.md"] });
    harness.owner.registerStoreExecutor(store.routeExecutor);
    harness.resolveCurrent();
    await vi.waitFor(() => {
      expect(readNote).toHaveBeenCalledOnce();
    });

    const decision = createDeferred<RouteGateResult>();
    const prepare = vi.fn<RouteTransitionGate["prepare"]>(
      () => decision.promise,
    );
    harness.owner.registerGate({ prepare, settle: vi.fn() });
    const candidate = harness.owner.selectNote("Projects/azurite.md");
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledOnce();
    });

    expect(store.getState()).toMatchObject({
      noteState: { status: "loading" },
      selectedNoteId: "index.md",
    });
    expect(readNote).toHaveBeenCalledOnce();
    decision.resolve({
      reason: "prerequisite_unavailable",
      status: "cancel",
    });
    await expect(candidate).resolves.toMatchObject({
      historyEffect: "entry_not_committed",
      noteId: "Projects/azurite.md",
      reason: "prerequisite_unavailable",
      status: "cancelled",
    });

    aRead.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Current A", "sha256-current-a"),
    });
    await vi.waitFor(() => {
      expect(store.getState().noteState.status).toBe("ready");
    });
    expect(harness.current().href).toBe("/?note=index.md");
    expect(harness.entries()).toHaveLength(1);
    expect(readNote).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({
      committedRouteView: { noteId: "index.md", view: "ready" },
      noteState: {
        editor: {
          currentMarkdown: "# Current A",
          note: { id: "index.md" },
        },
        status: "ready",
      },
      selectedNoteId: "index.md",
    });
  });
});

describe("route owner application cancellation", () => {
  it("cancels a push before it creates an entry or starts a read", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    const initialEntries = harness.entries();
    const settle = vi.fn<RouteTransitionGate["settle"]>();
    harness.owner.registerGate({
      prepare: () => ({ reason: "prerequisite_unavailable", status: "cancel" }),
      settle,
    });

    await expect(harness.owner.selectNote("b.md")).resolves.toMatchObject({
      historyEffect: "entry_not_committed",
      noteId: "b.md",
      reason: "prerequisite_unavailable",
      status: "cancelled",
    });
    expect(harness.entries()).toEqual(initialEntries);
    expect(executor.applyRoute).toHaveBeenCalledOnce();
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({ terminalStatus: "cancelled" }),
    );
  });

  it("settles a held stale application as one top-level supersession", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    const firstDecision = createDeferred<RouteGateResult>();
    const prepare = vi
      .fn<RouteTransitionGate["prepare"]>()
      .mockReturnValueOnce(firstDecision.promise)
      .mockReturnValue({ status: "continue" });
    const settle = vi.fn<RouteTransitionGate["settle"]>();
    harness.owner.registerGate({ prepare, settle });

    const stale = harness.owner.selectNote("b.md");
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledOnce();
    });
    const current = harness.owner.selectNote("c.md");
    await expect(current).resolves.toMatchObject({
      noteId: "c.md",
      status: "applied",
    });
    firstDecision.resolve({ status: "continue" });

    await expect(stale).resolves.toMatchObject({
      noteId: "b.md",
      phase: "awaiting_gate",
      status: "superseded",
    });
    expect(harness.current().href).toBe("/?note=c.md");
    expect(executor.applyRoute).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenCalledTimes(2);
  });
});

describe("route owner exact traversal restoration", () => {
  it.each([
    { delta: -1, initialIndex: 2, name: "Back" },
    { delta: 1, initialIndex: 0, name: "Forward" },
    { delta: -2, initialIndex: 2, name: "multi-entry Go" },
  ])(
    "restores and preserves every entry after cancelled $name",
    async (input) => {
      const harness = createRouteOwnerHarness({
        entries: ["/?note=a.md", "/?note=b.md", "/?note=c.md"],
        initialIndex: input.initialIndex,
      });
      const executor = createTestRouteExecutor();
      await settleInitialRoute(harness, executor);
      const predecessor = harness.current();
      const entries = harness.entries();
      const settle = vi.fn<RouteTransitionGate["settle"]>();
      const unregister = harness.owner.registerGate({
        prepare: () => ({ reason: "outgoing_owner_lost", status: "cancel" }),
        settle,
      });

      await harness.traverse(input.delta);
      await vi.waitFor(() => {
        expect(settle).toHaveBeenCalledOnce();
      });
      expect(harness.current()).toEqual(predecessor);
      expect(harness.entries()).toEqual(entries);
      expect(executor.applyRoute).toHaveBeenCalledOnce();

      unregister();
      await harness.traverse(input.delta);
      await vi.waitFor(() => {
        expect(executor.applyRoute).toHaveBeenCalledTimes(2);
      });
      expect(harness.current().state.__TSR_index).toBe(
        input.initialIndex + input.delta,
      );
      expect(harness.entries()).toEqual(entries);
    },
  );
});

describe("route owner restoration degradation", () => {
  it("publishes failure when exact predecessor confirmation is rejected", async () => {
    const harness = createRouteOwnerHarness({
      confirmRestoration: () => false,
      entries: ["/?note=a.md", "/?note=b.md"],
      initialIndex: 1,
    });
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    const settle = vi.fn<RouteTransitionGate["settle"]>();
    harness.owner.registerGate({
      prepare: () => ({ reason: "prerequisite_failed", status: "cancel" }),
      settle,
    });

    await harness.traverse(-1);
    await vi.waitFor(() => {
      expect(settle).toHaveBeenCalledWith(
        expect.objectContaining({ terminalStatus: "failed" }),
      );
    });
    expect(executor.reportHistoryUnavailable).toHaveBeenCalledOnce();
    expect(executor.applyRoute).toHaveBeenCalledOnce();
    expect(harness.current().href).toBe("/?note=b.md");
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
