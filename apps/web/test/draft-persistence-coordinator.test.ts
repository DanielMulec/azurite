import { afterEach, describe, expect, it, vi } from "vitest";

import { DraftPersistenceCoordinator } from "../src/persistence/draft-persistence-coordinator.js";
import type { DraftPersistence } from "../src/persistence/draft-database.js";
import { createDraftRecord } from "../src/persistence/draft-records.js";
import type { DraftMutationSnapshot } from "../src/persistence/draft-workflow-types.js";
import { createDeferred } from "./note-browser-store-test-helpers.js";

const clusterId = "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793";

afterEach(() => {
  vi.useRealTimers();
});

describe("ordered draft persistence", () => {
  it("makes a consistent read wait behind a scheduled same-note write", async () => {
    const releaseWrite = createDeferred<undefined>();
    const writeStarted = createDeferred<undefined>();
    const memory = createMemoryPersistence();
    const readDraft = vi.fn(memory.persistence.readDraft);
    const coordinator = createCoordinator({
      ...memory.persistence,
      readDraft,
      writeDraft: async (draft) => {
        writeStarted.resolve(undefined);
        await releaseWrite.promise;
        return await memory.persistence.writeDraft(draft);
      },
    });
    const snapshot = createSnapshot({ markdown: "# Ordered write" });
    admit(coordinator, snapshot);

    const read = coordinator.readDraft(clusterId, snapshot.noteId);
    await writeStarted.promise;
    expect(readDraft).not.toHaveBeenCalled();
    releaseWrite.resolve(undefined);

    await expect(read).resolves.toMatchObject({
      draft: { markdown: "# Ordered write" },
      status: "found_current",
    });
    expect(coordinator.activeKeyCount).toBe(0);
    expect(coordinator.pendingSnapshotCount).toBe(0);
  });
});

describe("draft snapshot coalescing", () => {
  it("coalesces a not-yet-started older snapshot without writing it", async () => {
    const memory = createMemoryPersistence();
    const writeDraft = vi.fn(memory.persistence.writeDraft);
    const coordinator = createCoordinator({
      ...memory.persistence,
      writeDraft,
    });
    const firstSettlement = vi.fn();
    const first = createSnapshot({ markdown: "# Older", revision: 1 });
    const second = createSnapshot({
      markdown: "# Newest",
      revision: 2,
      snapshotKey: "session:2",
    });
    admit(coordinator, first, firstSettlement);
    admit(coordinator, second);

    await expect(
      coordinator.flushSnapshot(second.snapshotKey),
    ).resolves.toEqual({
      status: "written",
    });

    expect(firstSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ result: { status: "superseded" } }),
    );
    expect(writeDraft).toHaveBeenCalledOnce();
    expect(writeDraft.mock.calls[0]?.[0]).toMatchObject({
      markdown: "# Newest",
    });
    expect(coordinator.pendingSnapshotCount).toBe(0);
  });
});

describe("failed draft retry", () => {
  it("retains and retries the same immutable failed write", async () => {
    const memory = createMemoryPersistence();
    const writeDraft = vi
      .fn<DraftPersistence["writeDraft"]>()
      .mockResolvedValueOnce({
        reason: "quota_exceeded",
        status: "unavailable",
      })
      .mockImplementation(memory.persistence.writeDraft);
    const coordinator = createCoordinator({
      ...memory.persistence,
      writeDraft,
    });
    const snapshot = createSnapshot({ markdown: "# Retry exact" });
    admit(coordinator, snapshot);

    await expect(
      coordinator.flushSnapshot(snapshot.snapshotKey),
    ).resolves.toEqual({
      reason: "quota_exceeded",
      status: "unavailable",
    });
    expect(coordinator.pendingSnapshotCount).toBe(1);
    await expect(
      coordinator.retrySnapshot(snapshot.snapshotKey),
    ).resolves.toEqual({
      status: "written",
    });

    expect(writeDraft).toHaveBeenCalledTimes(2);
    expect(writeDraft.mock.calls[0]?.[0]).toEqual(
      writeDraft.mock.calls[1]?.[0],
    );
    expect(coordinator.pendingSnapshotCount).toBe(0);
  });
});

describe("unbound draft binding", () => {
  it("binds original unbound content after identity repair", async () => {
    const memory = createMemoryPersistence();
    const writeDraft = vi.fn(memory.persistence.writeDraft);
    const coordinator = createCoordinator({
      ...memory.persistence,
      writeDraft,
    });
    const snapshot = createSnapshot({
      clusterId: undefined,
      markdown: "# Captured before identity",
    });
    admit(coordinator, snapshot);

    expect(coordinator.unboundSnapshotCount).toBe(1);
    expect(writeDraft).not.toHaveBeenCalled();
    coordinator.bindSessionCluster(snapshot.sessionKey, clusterId);
    await expect(
      coordinator.flushSnapshot(snapshot.snapshotKey),
    ).resolves.toEqual({
      status: "written",
    });

    expect(writeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        baseContentHash: snapshot.baseContentHash,
        editorMode: snapshot.editorMode,
        markdown: snapshot.markdown,
      }),
    );
    expect(coordinator.unboundSnapshotCount).toBe(0);
    expect(coordinator.pendingSnapshotCount).toBe(0);
  });
});

describe("terminal and independent draft work", () => {
  it("cancels a scheduled write before terminal Discard deletes", async () => {
    vi.useFakeTimers();
    const memory = createMemoryPersistence();
    const writeDraft = vi.fn(memory.persistence.writeDraft);
    const deleteDraft = vi.fn(memory.persistence.deleteDraft);
    const coordinator = createCoordinator({
      ...memory.persistence,
      deleteDraft,
      writeDraft,
    });
    const snapshot = createSnapshot();
    admit(coordinator, snapshot);

    await expect(
      coordinator.discard({
        clusterId,
        draftEpoch: snapshot.draftEpoch,
        noteId: snapshot.noteId,
        ownerKey: snapshot.sessionKey,
      }),
    ).resolves.toEqual({ status: "absent" });

    expect(writeDraft).not.toHaveBeenCalled();
    expect(deleteDraft).toHaveBeenCalledOnce();
    expect(coordinator.pendingSnapshotCount).toBe(0);
    expect(coordinator.activeKeyCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("repeated lifecycle flush admission", () => {
  it("shares one receipt and performs one immutable draft write", async () => {
    vi.useFakeTimers();
    const memory = createMemoryPersistence();
    const writeDraft = vi.fn(memory.persistence.writeDraft);
    const coordinator = createCoordinator({
      ...memory.persistence,
      writeDraft,
    });
    const snapshot = createSnapshot();
    const settled = vi.fn();
    admit(coordinator, snapshot, settled);

    const visibilityFlush = coordinator.flushSnapshot(snapshot.snapshotKey);
    const pageHideFlush = coordinator.flushSnapshot(snapshot.snapshotKey);
    const unmountFlush = coordinator.flushSnapshot(snapshot.snapshotKey);

    await expect(visibilityFlush).resolves.toEqual({ status: "written" });
    await expect(pageHideFlush).resolves.toEqual({ status: "written" });
    await expect(unmountFlush).resolves.toEqual({ status: "written" });
    expect(writeDraft).toHaveBeenCalledOnce();
    expect(settled).toHaveBeenCalledOnce();
    expect(coordinator.pendingSnapshotCount).toBe(0);
    expect(coordinator.activeKeyCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("started Discard ordering", () => {
  it("orders Discard after an already-started write", async () => {
    const releaseWrite = createDeferred<undefined>();
    const writeStarted = createDeferred<undefined>();
    const calls: string[] = [];
    const memory = createMemoryPersistence();
    const coordinator = createCoordinator({
      ...memory.persistence,
      deleteDraft: async (targetCluster, noteId) => {
        calls.push("delete");
        return await memory.persistence.deleteDraft(targetCluster, noteId);
      },
      writeDraft: async (draft) => {
        calls.push("write-start");
        writeStarted.resolve(undefined);
        await releaseWrite.promise;
        calls.push("write-end");
        return await memory.persistence.writeDraft(draft);
      },
    });
    const snapshot = createSnapshot();
    admit(coordinator, snapshot);
    const write = coordinator.flushSnapshot(snapshot.snapshotKey);
    await writeStarted.promise;
    const discard = coordinator.discard({
      clusterId,
      draftEpoch: snapshot.draftEpoch,
      noteId: snapshot.noteId,
      ownerKey: snapshot.sessionKey,
    });

    expect(calls).toEqual(["write-start"]);
    releaseWrite.resolve(undefined);
    await write;
    await discard;

    expect(calls).toEqual(["write-start", "write-end", "delete"]);
    expect(coordinator.activeKeyCount).toBe(0);
  });
});

describe("draft note independence", () => {
  it("allows another note to complete while one note is blocked", async () => {
    const releaseFirst = createDeferred<undefined>();
    const firstStarted = createDeferred<undefined>();
    const memory = createMemoryPersistence();
    const coordinator = createCoordinator({
      ...memory.persistence,
      writeDraft: async (draft) => {
        if (draft.noteId === "first.md") {
          firstStarted.resolve(undefined);
          await releaseFirst.promise;
        }
        return await memory.persistence.writeDraft(draft);
      },
    });
    const first = createSnapshot({ noteId: "first.md", snapshotKey: "first" });
    const second = createSnapshot({
      noteId: "second.md",
      sessionKey: "second-session",
      snapshotKey: "second",
    });
    admit(coordinator, first);
    admit(coordinator, second);
    const firstFlush = coordinator.flushSnapshot(first.snapshotKey);
    await firstStarted.promise;

    await expect(
      coordinator.flushSnapshot(second.snapshotKey),
    ).resolves.toEqual({
      status: "written",
    });
    releaseFirst.resolve(undefined);
    await firstFlush;
    expect(coordinator.activeKeyCount).toBe(0);
  });
});

describe("draft queue recovery", () => {
  it("converts a rejected read and releases the key for later work", async () => {
    const memory = createMemoryPersistence();
    const readDraft = vi
      .fn<DraftPersistence["readDraft"]>()
      .mockRejectedValueOnce(new Error("Injected queue task rejection."))
      .mockImplementation(memory.persistence.readDraft);
    const coordinator = createCoordinator({ ...memory.persistence, readDraft });

    await expect(coordinator.readDraft(clusterId, "note.md")).resolves.toEqual({
      clusterId,
      noteId: "note.md",
      reason: "queue_task_failed",
      status: "queue_failed",
    });
    await expect(coordinator.readDraft(clusterId, "note.md")).resolves.toEqual({
      clusterId,
      noteId: "note.md",
      status: "absent",
    });
    expect(coordinator.activeKeyCount).toBe(0);
  });
});

function createCoordinator(persistence: DraftPersistence) {
  return new DraftPersistenceCoordinator({ delayMs: 60_000, persistence });
}

function admit(
  coordinator: DraftPersistenceCoordinator,
  snapshot: DraftMutationSnapshot,
  onSettled = vi.fn(),
): void {
  expect(
    coordinator.prepareSnapshot({ isCurrent: () => true, onSettled, snapshot }),
  ).toMatchObject({ status: "prepared" });
  coordinator.commitPrepared(snapshot.snapshotKey);
}

function createSnapshot(
  patch: Partial<DraftMutationSnapshot> = {},
): DraftMutationSnapshot {
  return {
    baseContentHash: "sha256-base",
    cause: "accepted_change",
    clusterId,
    contentDirty: true,
    disposition: "generated_pending",
    draftEpoch: 0,
    editorMode: "wysiwyg",
    markdown: "# Draft",
    noteId: "note.md",
    revision: 1,
    sessionKey: "session",
    snapshotKey: "session:1",
    ...patch,
  };
}

function createMemoryPersistence() {
  const records = new Map<string, ReturnType<typeof createDraftRecord>>();
  const key = (targetCluster: string, noteId: string) =>
    `${targetCluster}\u0000${noteId}`;
  const persistence: DraftPersistence = {
    deleteDraft: (targetCluster, noteId) =>
      Promise.resolve({
        status: records.delete(key(targetCluster, noteId))
          ? "deleted"
          : "absent",
      }),
    deleteDraftIfSavedSnapshotMatches: () =>
      Promise.resolve({ status: "absent" }),
    readDraft: (targetCluster, noteId) => {
      const draft = records.get(key(targetCluster, noteId));
      return Promise.resolve(
        draft === undefined
          ? { clusterId: targetCluster, noteId, status: "absent" }
          : { draft, status: "found_current" },
      );
    },
    writeDraft: (draft) => {
      records.set(key(draft.clusterId, draft.noteId), draft);
      return Promise.resolve({ status: "written" });
    },
  };
  return { persistence };
}
