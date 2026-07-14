import { describe, expect, it, vi } from "vitest";

import type { DraftPersistence } from "../src/persistence/draft-database.js";
import { DraftPersistenceCoordinator } from "../src/persistence/draft-persistence-coordinator.js";
import type { DraftMutationSnapshot } from "../src/persistence/draft-workflow-types.js";
import { createDeferred } from "./note-browser-store-test-helpers.js";

describe("closed draft epochs", () => {
  it("rejects old admission and prevents scheduled work from recreating a record", async () => {
    const persistence = createPersistence();
    const coordinator = new DraftPersistenceCoordinator({
      delayMs: 60_000,
      persistence,
    });
    const snapshot = createSnapshot();
    expect(
      coordinator.prepareSnapshot({
        isCurrent: () => true,
        onSettled: vi.fn(),
        snapshot,
      }),
    ).toMatchObject({ status: "prepared" });
    coordinator.commitPrepared(snapshot.snapshotKey);

    coordinator.closeEpoch(snapshot.sessionKey, snapshot.draftEpoch);

    await expect(
      coordinator.flushSnapshot(snapshot.snapshotKey),
    ).resolves.toEqual({ status: "superseded" });
    expect(persistence.writeDraft).not.toHaveBeenCalled();
    expect(
      coordinator.prepareSnapshot({
        isCurrent: () => true,
        onSettled: vi.fn(),
        snapshot: { ...snapshot, snapshotKey: "session:late" },
      }),
    ).toMatchObject({ reason: "closed_epoch", status: "rejected" });
    expect(coordinator.pendingSnapshotCount).toBe(0);
    expect(coordinator.activeKeyCount).toBe(0);
  });

  it("does not retain a started failure after Discard closes the epoch", async () => {
    const writeResult =
      createDeferred<Awaited<ReturnType<DraftPersistence["writeDraft"]>>>();
    const writeStarted = createDeferred<undefined>();
    const persistence = createPersistence();
    const coordinator = new DraftPersistenceCoordinator({
      delayMs: 60_000,
      persistence: {
        ...persistence,
        writeDraft: async () => {
          writeStarted.resolve(undefined);
          return await writeResult.promise;
        },
      },
    });
    const snapshot = createSnapshot();
    expect(
      coordinator.prepareSnapshot({
        isCurrent: () => true,
        onSettled: vi.fn(),
        snapshot,
      }),
    ).toMatchObject({ status: "prepared" });
    coordinator.commitPrepared(snapshot.snapshotKey);
    const write = coordinator.flushSnapshot(snapshot.snapshotKey);
    await writeStarted.promise;
    const discard = coordinator.discard({
      clusterId: requireClusterId(snapshot),
      draftEpoch: snapshot.draftEpoch,
      noteId: snapshot.noteId,
      ownerKey: snapshot.sessionKey,
    });

    writeResult.resolve({ reason: "quota_exceeded", status: "unavailable" });
    await expect(write).resolves.toMatchObject({ status: "failed" });
    await expect(discard).resolves.toMatchObject({ status: "cleared" });
    expect(coordinator.pendingSnapshotCount).toBe(0);
    expect(coordinator.activeKeyCount).toBe(0);
  });
});

function createPersistence(): DraftPersistence {
  return {
    deleteDraft: () => Promise.resolve({ status: "absent" }),
    deleteDraftIfSavedSnapshotMatches: () =>
      Promise.resolve({ status: "absent" }),
    readDraft: (clusterId, noteId) =>
      Promise.resolve({ clusterId, noteId, status: "absent" }),
    writeDraft: vi.fn<DraftPersistence["writeDraft"]>(() =>
      Promise.resolve({ status: "written" }),
    ),
  };
}

function createSnapshot(): DraftMutationSnapshot {
  return {
    baseContentHash: "sha256-base",
    cause: "accepted_change",
    clusterId: "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793",
    contentDirty: true,
    disposition: "generated_pending",
    draftEpoch: 0,
    editorMode: "wysiwyg",
    markdown: "# Must not reappear",
    noteId: "index.md",
    revision: 1,
    sessionKey: "session",
    snapshotKey: "session:1",
  };
}

function requireClusterId(snapshot: DraftMutationSnapshot): string {
  if (snapshot.clusterId === undefined) {
    throw new Error("Expected a cluster-bound snapshot.");
  }
  return snapshot.clusterId;
}
