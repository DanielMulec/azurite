import { describe, expect, it, vi } from "vitest";

import {
  createEditorSessionGate,
  type EditorControllerCapability,
} from "../src/components/editor-session-gate.js";
import type { DraftPersistence } from "../src/persistence/draft-database.js";
import type { CommitResult } from "../src/domain/markdown-authority-types.js";
import {
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createSeededStore,
} from "./note-browser-store-test-helpers.js";

describe("editor session route gate", () => {
  it("shares one commit and durability operation while retaining exact leases", async () => {
    const memory = createMemoryDraftPersistence();
    const releaseWrite = createDeferred<undefined>();
    const writeStarted = createDeferred<undefined>();
    const writeDraft = vi.fn<DraftPersistence["writeDraft"]>(async (draft) => {
      writeStarted.resolve(undefined);
      await releaseWrite.promise;
      return await memory.persistence.writeDraft(draft);
    });
    const store = createLoadedStore({
      draftPersistence: { ...memory.persistence, writeDraft },
    });
    const gate = createEditorSessionGate(store);
    const controller = createController(getSessionKey(store));
    gate.registerController(controller.capability);
    store.getState().updateDraftMarkdown("# Durable before handoff");

    const first = gate.routeGate.prepare(createInput("lease-one", store));
    const second = gate.routeGate.prepare(createInput("lease-two", store));
    await writeStarted.promise;

    expect(controller.commit).toHaveBeenCalledOnce();
    expect(writeDraft).toHaveBeenCalledOnce();
    expect(controller.setFrozen).toHaveBeenCalledWith(true);
    expect(gate.getSnapshot()).toEqual({
      frozenSessionKey: getSessionKey(store),
      message: "Opening note...",
    });

    releaseWrite.resolve(undefined);
    await expect(first).resolves.toEqual({ status: "continue" });
    await expect(second).resolves.toEqual({ status: "continue" });
    await gate.routeGate.settle({
      leaseKey: "lease-one",
      surfaceEffect: "none",
      terminalStatus: "superseded",
    });
    expect(gate.isSessionFrozen(getSessionKey(store))).toBe(true);
    await gate.routeGate.settle({
      leaseKey: "lease-two",
      surfaceEffect: "retained",
      terminalStatus: "cancelled",
    });

    expect(controller.setFrozen).toHaveBeenLastCalledWith(false);
    expect(gate.getSnapshot()).toEqual({
      frozenSessionKey: undefined,
      message: undefined,
    });
  });
});

describe("editor session durability cancellation", () => {
  it("cancels unavailable durability and restores the retained controller", async () => {
    const memory = createMemoryDraftPersistence();
    const store = createLoadedStore({
      draftPersistence: {
        ...memory.persistence,
        writeDraft: () =>
          Promise.resolve({ reason: "quota_exceeded", status: "unavailable" }),
      },
    });
    const gate = createEditorSessionGate(store);
    const controller = createController(getSessionKey(store));
    gate.registerController(controller.capability);
    store.getState().updateDraftMarkdown("# Not durable");

    await expect(
      gate.routeGate.prepare(createInput("lease", store)),
    ).resolves.toEqual({
      reason: "prerequisite_unavailable",
      status: "cancel",
    });
    await gate.routeGate.settle({
      leaseKey: "lease",
      surfaceEffect: "retained",
      terminalStatus: "cancelled",
    });

    expect(controller.setFrozen).toHaveBeenLastCalledWith(false);
    expect(getEditor(store).currentMarkdown).toBe("# Not durable");
  });
});

describe("editor session commit failure", () => {
  it("does not freeze when commit fails", async () => {
    const store = createLoadedStore();
    const gate = createEditorSessionGate(store);
    const controller = createController(getSessionKey(store), {
      cause: "route_transition",
      reason: "projection_read_failed",
      sessionKey: getSessionKey(store),
      status: "failed",
    });
    gate.registerController(controller.capability);

    await expect(
      gate.routeGate.prepare(createInput("lease", store)),
    ).resolves.toEqual({
      reason: "prerequisite_failed",
      status: "cancel",
    });
    expect(controller.setFrozen).not.toHaveBeenCalled();
    expect(gate.getSnapshot().frozenSessionKey).toBeUndefined();
  });
});

describe("editor session owner absence", () => {
  it("distinguishes no editor from a lost ready-session controller", async () => {
    const emptyStore = createSeededStore();
    const emptyGate = createEditorSessionGate(emptyStore);
    await expect(
      emptyGate.routeGate.prepare({
        cause: "url_sync",
        leaseKey: "empty",
        outgoingOwnerKey: undefined,
      }),
    ).resolves.toEqual({ status: "continue" });

    const loadedStore = createLoadedStore();
    const loadedGate = createEditorSessionGate(loadedStore);
    await expect(
      loadedGate.routeGate.prepare(createInput("lost", loadedStore)),
    ).resolves.toEqual({
      reason: "outgoing_owner_lost",
      status: "cancel",
    });
  });
});

function createController(
  sessionKey: string,
  result: CommitResult = {
    cause: "route_transition",
    reason: "source_authority_current",
    revision: 0,
    sessionKey,
    status: "no_change",
  },
) {
  const commit = vi.fn(() => result);
  const setFrozen = vi.fn();
  const capability: EditorControllerCapability = {
    commit,
    sessionKey,
    setFrozen,
  };
  return { capability, commit, setFrozen };
}

function createInput(
  leaseKey: string,
  store: ReturnType<typeof createLoadedStore>,
) {
  return {
    cause: "note_list" as const,
    leaseKey,
    outgoingOwnerKey: getSessionKey(store),
  };
}

function getSessionKey(store: ReturnType<typeof createLoadedStore>): string {
  return getEditor(store).sessionKey;
}

function getEditor(store: ReturnType<typeof createLoadedStore>) {
  const state = store.getState().noteState;
  if (state.status !== "ready") {
    throw new Error("Expected a ready editor.");
  }
  return state.editor;
}
