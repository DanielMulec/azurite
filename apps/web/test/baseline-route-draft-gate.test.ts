import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DraftPersistence,
  DraftWriteResult,
} from "../src/persistence/draft-database.js";
import { createBaselineRouteDraftGate } from "../src/state/baseline-route-draft-gate.js";
import {
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
} from "./note-browser-store-test-helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("baseline route draft gate ownership", () => {
  it("joins the active flush while a later edit remains scheduler-owned", async () => {
    vi.useFakeTimers();
    const firstWrite = createDeferred<DraftWriteResult>();
    const writeDraft = vi
      .fn<DraftPersistence["writeDraft"]>()
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValue({ status: "written" });
    const store = createGateStore(writeDraft);
    const gate = createBaselineRouteDraftGate(store);
    store.getState().updateDraftMarkdown("# First edit");

    const first = gate.prepare(createInput("lease-one"));
    expect(writeDraft).toHaveBeenCalledOnce();
    store.getState().updateDraftMarkdown("# Later edit");
    const second = gate.prepare(createInput("lease-two"));
    expect(writeDraft).toHaveBeenCalledOnce();
    firstWrite.resolve({ status: "written" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "continue" },
      { status: "continue" },
    ]);
    await vi.advanceTimersByTimeAsync(250);
    expect(writeDraft).toHaveBeenCalledTimes(2);
  });
});

describe("baseline route draft gate degradation", () => {
  it("records unavailable persistence and continues navigation", async () => {
    const writeDraft = vi.fn<DraftPersistence["writeDraft"]>(() =>
      Promise.resolve({ reason: "quota_exceeded", status: "unavailable" }),
    );
    const store = createGateStore(writeDraft);
    store.getState().updateDraftMarkdown("# Quota pressure");

    await expect(
      createBaselineRouteDraftGate(store).prepare(createInput("lease")),
    ).resolves.toEqual({ status: "continue" });
    expect(store.getState().draftRecoveryStatus).toMatchObject({
      reason: "quota_exceeded",
      status: "degraded",
    });
  });

  it("contains a thrown flush and allows the next exact attempt", async () => {
    const writeDraft = vi
      .fn<DraftPersistence["writeDraft"]>()
      .mockRejectedValueOnce(new Error("Injected persistence throw."))
      .mockResolvedValueOnce({ status: "written" });
    const store = createGateStore(writeDraft);
    const unsubscribe = store.subscribe((state) => {
      if (state.draftRecoveryStatus.status === "degraded") {
        throw new Error("Injected subscriber throw.");
      }
    });
    const gate = createBaselineRouteDraftGate(store);
    store.getState().updateDraftMarkdown("# Failed attempt");

    await expect(gate.prepare(createInput("lease-one"))).resolves.toEqual({
      status: "continue",
    });
    expect(store.getState().draftRecoveryStatus).toMatchObject({
      reason: "write_failed",
      status: "degraded",
    });
    unsubscribe();
    store.getState().updateDraftMarkdown("# Retry attempt");
    await expect(gate.prepare(createInput("lease-two"))).resolves.toEqual({
      status: "continue",
    });
    expect(writeDraft).toHaveBeenCalledTimes(2);
  });
});

function createGateStore(
  writeDraft: DraftPersistence["writeDraft"],
): ReturnType<typeof createLoadedStore> {
  const drafts = createMemoryDraftPersistence();
  return createLoadedStore({
    draftPersistence: { ...drafts.persistence, writeDraft },
  });
}

function createInput(leaseKey: string) {
  return { cause: "note_list" as const, leaseKey, outgoingOwnerKey: "owner" };
}
