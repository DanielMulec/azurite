import { describe, expect, it, vi } from "vitest";

import {
  createRouteOwnerHarness,
  type RouteOwnerHarness,
} from "./route-transition-owner-test-helpers.js";
import { createTestRouteExecutor } from "./route-store-executor-test-helper.js";

describe("route owner store failure outcomes", () => {
  it("returns notes-list failure without admitting the target read", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    executor.ensureNotes.mockResolvedValue({ status: "failed" });

    await expect(harness.owner.selectNote("b.md")).resolves.toMatchObject({
      noteId: "b.md",
      reason: "notes_list_failed",
      status: "failed",
      surfaceEffect: "retained",
    });
    expect(executor.applyRoute).toHaveBeenCalledOnce();
  });

  it("maps a current read failure to the target-owned error surface", async () => {
    const harness = createRouteOwnerHarness();
    const executor = createTestRouteExecutor();
    await settleInitialRoute(harness, executor);
    executor.applyRoute.mockResolvedValueOnce({
      reason: "note_read_failed",
      status: "failed",
    });

    await expect(harness.owner.selectNote("b.md")).resolves.toMatchObject({
      noteId: "b.md",
      reason: "note_read_failed",
      status: "failed",
      surfaceEffect: "replaced_by_error",
    });
  });
});

describe("route owner explicit missing and empty routes", () => {
  it("applies an explicit missing route even when the ready list is empty", async () => {
    const harness = createRouteOwnerHarness({ entries: ["/?note=missing.md"] });
    const executor = createTestRouteExecutor();
    executor.ensureNotes.mockResolvedValue({ noteIds: [], status: "ready" });
    executor.applyRoute.mockResolvedValue({
      requestSequence: 1,
      status: "applied",
      view: "missing",
    });
    harness.owner.registerStoreExecutor(executor.executor);
    harness.resolveCurrent();

    await vi.waitFor(() => {
      expect(executor.applyRoute).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: "missing.md" }),
      );
    });
    expect(harness.navigations()).toEqual([]);
  });

  it("commits empty only for an undefined route and empty ready list", async () => {
    const harness = createRouteOwnerHarness({ entries: ["/"] });
    const executor = createTestRouteExecutor();
    executor.ensureNotes.mockResolvedValue({ noteIds: [], status: "ready" });
    harness.owner.registerStoreExecutor(executor.executor);
    harness.resolveCurrent();

    await vi.waitFor(() => {
      expect(executor.applyRoute).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: undefined }),
      );
    });
    expect(executor.applyRoute).toHaveReturned();
    expect(harness.navigations()).toEqual([]);
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
