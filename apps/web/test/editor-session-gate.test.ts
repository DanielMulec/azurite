import { describe, expect, it, vi } from "vitest";

import {
  createEditorSessionGate,
  type EditorControllerCapability,
} from "../src/components/editor-session-gate.js";
import { MarkdownAuthorityController } from "../src/components/markdown-authority-controller.js";
import type { DraftPersistence } from "../src/persistence/draft-database.js";
import type { CommitResult } from "../src/domain/markdown-authority-types.js";
import {
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createSeededStore,
  publishSourceMarkdown,
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
    publishSourceMarkdown(store, "# Durable before handoff");

    const first = gate.routeGate.prepare(createInput("lease-one", store));
    const second = gate.routeGate.prepare(createInput("lease-two", store));
    await writeStarted.promise;

    expect(controller.commit).toHaveBeenCalledOnce();
    expect(writeDraft).toHaveBeenCalledOnce();
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

    expect(gate.getSnapshot()).toEqual({
      frozenSessionKey: undefined,
      message: undefined,
    });
  });
});

describe("editor session freeze authority", () => {
  it("uses the gate's single freeze truth for route and terminal work", async () => {
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
    let projection = "# Home";
    const controller = new MarkdownAuthorityController({
      isSessionFrozen: gate.isSessionFrozen,
      onModeChange: (mode) => {
        store.getState().updateEditorMode(mode);
      },
      publish: (command) => store.getState().publishMarkdownChange(command),
      readProjection: () => projection,
      readSession: (sessionKey) => {
        const state = store.getState().noteState;
        return state.status === "ready" &&
          state.editor.sessionKey === sessionKey
          ? state.editor
          : undefined;
      },
      replaceProjection: (markdown) => {
        projection = markdown;
      },
      sessionKey: getSessionKey(store),
    });
    expect(controller.markReady("# Home")).toEqual({
      cause: "creation",
      status: "synchronized",
    });
    gate.registerController(controller);
    expect(controller.publishSource("# Durable before route")).toEqual({
      status: "accepted",
    });

    const route = gate.routeGate.prepare(createInput("lease", store));
    await writeStarted.promise;
    expect(gate.isSessionFrozen(controller.sessionKey)).toBe(true);
    expect(controller.publishSource("# Late route edit")).toEqual({
      reason: "lifecycle",
      status: "ignored",
    });
    expect(getEditor(store).currentMarkdown).toBe("# Durable before route");

    releaseWrite.resolve(undefined);
    await expect(route).resolves.toEqual({ status: "continue" });
    await gate.routeGate.settle({
      leaseKey: "lease",
      surfaceEffect: "retained",
      terminalStatus: "cancelled",
    });
    expect(gate.isSessionFrozen(controller.sessionKey)).toBe(false);
    expect(controller.publishSource("# Resumed after route")).toEqual({
      status: "accepted",
    });

    const releaseTerminal = createDeferred<undefined>();
    const terminal = gate.runTerminalAction(controller.sessionKey, async () => {
      await releaseTerminal.promise;
    });
    expect(gate.isSessionFrozen(controller.sessionKey)).toBe(true);
    expect(controller.publishSource("# Late terminal edit")).toEqual({
      reason: "lifecycle",
      status: "ignored",
    });
    expect(getEditor(store).currentMarkdown).toBe("# Resumed after route");

    releaseTerminal.resolve(undefined);
    await terminal;
    expect(gate.isSessionFrozen(controller.sessionKey)).toBe(false);
    expect(controller.publishSource("# Resumed after terminal")).toEqual({
      status: "accepted",
    });
    expect(getEditor(store).currentMarkdown).toBe("# Resumed after terminal");
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
    publishSourceMarkdown(store, "# Not durable");

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

    expect(getEditor(store).currentMarkdown).toBe("# Not durable");
  });

  it("blocks a rejected flush and lets a later exact attempt continue", async () => {
    const store = createLoadedStore();
    const flushPendingDraft = vi
      .fn<ReturnType<typeof store.getState>["flushPendingDraft"]>()
      .mockRejectedValueOnce(new Error("coordinator rejected"))
      .mockResolvedValue({ status: "continue" });
    store.setState({ flushPendingDraft });
    const gate = createEditorSessionGate(store);
    const controller = createController(getSessionKey(store));
    gate.registerController(controller.capability);

    await expect(
      gate.routeGate.prepare(createInput("rejected", store)),
    ).resolves.toEqual({
      reason: "prerequisite_unavailable",
      status: "cancel",
    });
    gate.routeGate.settle({
      leaseKey: "rejected",
      surfaceEffect: "retained",
      terminalStatus: "cancelled",
    });

    await expect(
      gate.routeGate.prepare(createInput("retry", store)),
    ).resolves.toEqual({ status: "continue" });
    expect(flushPendingDraft).toHaveBeenCalledTimes(2);
  });
});

describe("editor session commit failure", () => {
  it("does not freeze when commit fails", async () => {
    const store = createLoadedStore();
    const gate = createEditorSessionGate(store);
    const controller = createController(getSessionKey(store), {
      reason: "projection_read_failed",
      status: "block",
    });
    gate.registerController(controller.capability);

    await expect(
      gate.routeGate.prepare(createInput("lease", store)),
    ).resolves.toEqual({
      reason: "prerequisite_failed",
      status: "cancel",
    });
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
  result: CommitResult = { status: "proceed" },
) {
  const commit = vi.fn(() => result);
  const capability: EditorControllerCapability = {
    commit,
    sessionKey,
  };
  return { capability, commit };
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
