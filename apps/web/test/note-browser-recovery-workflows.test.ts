import { describe, expect, it, vi } from "vitest";

import type { DraftPersistence } from "../src/persistence/draft-database.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import {
  createApi,
  createLoadedStore,
  createMemoryDraftPersistence,
  createTestDraft,
  publishSourceMarkdown,
  readyClusterIdentity,
} from "./note-browser-store-test-helpers.js";
import { loadTestRoute } from "./note-browser-route-test-helpers.js";

describe("browser recovery retry", () => {
  it("resolves an unavailable read only while clean and preserves route coherence", async () => {
    const readDraft = vi
      .fn<DraftPersistence["readDraft"]>()
      .mockResolvedValueOnce({
        clusterId: readyClusterIdentity.clusterId,
        noteId: "index.md",
        reason: "database_unavailable",
        status: "unavailable",
      })
      .mockResolvedValueOnce({
        clusterId: readyClusterIdentity.clusterId,
        noteId: "index.md",
        status: "absent",
      });
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: createPersistence({ readDraft }),
    });
    await loadTestRoute(store, "index.md");
    const previousOwner = getEditor(store).sessionKey;

    expect(getEditor(store)).toMatchObject({
      draftDisposition: "recovery_read_unavailable",
      persistenceIssue: {
        clusterId: readyClusterIdentity.clusterId,
        retryAction: "retry_browser_recovery",
      },
    });
    await expect(
      store.getState().retryDraftPersistenceIssue(),
    ).resolves.toBeUndefined();
    expect(getEditor(store)).toMatchObject({
      draftDisposition: "none",
      persistenceIssue: undefined,
    });
    expect(store.getState().draftRecoveryStatus).toEqual({
      status: "available",
    });
    expect(getEditor(store).sessionKey).not.toBe(previousOwner);
    expect(store.getState().committedRouteView).toMatchObject({
      renderedOwnerKey: getEditor(store).sessionKey,
    });
  });
});

describe("dirty browser recovery retry", () => {
  it("cannot replace exact dirty authority with a late recovery read", async () => {
    const readDraft = vi.fn<DraftPersistence["readDraft"]>(() =>
      Promise.resolve({
        clusterId: readyClusterIdentity.clusterId,
        noteId: "index.md",
        reason: "database_unavailable",
        status: "unavailable",
      }),
    );
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: createPersistence({ readDraft }),
    });
    await loadTestRoute(store, "index.md");
    publishSourceMarkdown(store, "# Exact live edit");

    expect(getEditor(store).persistenceIssue?.retryAction).toBeUndefined();
    await expect(
      store.getState().retryDraftPersistenceIssue(),
    ).resolves.toBeUndefined();
    expect(getEditor(store).currentMarkdown).toBe("# Exact live edit");
    expect(readDraft).toHaveBeenCalledOnce();
  });
});

describe("protected future-version recovery", () => {
  it("never writes, cleans, or discards the protected record", async () => {
    const readDraft = vi.fn<DraftPersistence["readDraft"]>(() =>
      Promise.resolve({
        clusterId: readyClusterIdentity.clusterId,
        noteId: "index.md",
        schemaVersion: 7,
        status: "preserved_unknown",
      }),
    );
    const writeDraft = vi.fn<DraftPersistence["writeDraft"]>();
    const deleteDraft = vi.fn<DraftPersistence["deleteDraft"]>();
    const deleteSaved =
      vi.fn<DraftPersistence["deleteDraftIfSavedSnapshotMatches"]>();
    const saveNote = vi.fn(createApi().saveNote);
    const store = createNoteBrowserStore({
      api: createApi({ saveNote }),
      draftPersistence: createPersistence({
        deleteDraft,
        deleteDraftIfSavedSnapshotMatches: deleteSaved,
        readDraft,
        writeDraft,
      }),
    });
    await loadTestRoute(store, "index.md");

    store.getState().updateEditorMode("markdown");
    publishSourceMarkdown(store, "# Save without touching future data");
    await store.getState().flushPendingDraft();
    await store.getState().saveSelectedNote();
    await store.getState().discardCurrentDraft();

    expect(getEditor(store)).toMatchObject({
      draftDisposition: "preserved_unknown",
      preservedSchemaVersion: 7,
    });
    expect(saveNote).toHaveBeenCalledOnce();
    expect(writeDraft).not.toHaveBeenCalled();
    expect(deleteDraft).not.toHaveBeenCalled();
    expect(deleteSaved).not.toHaveBeenCalled();
  });
});

describe("successful Save cleanup retry", () => {
  it("deletes the exact retained obligation without a second PUT", async () => {
    const draft = createTestDraft({
      baseContentHash: "sha256-old",
      markdown: "# Home",
    });
    const memory = createMemoryDraftPersistence([draft]);
    const deleteSaved = vi
      .fn<DraftPersistence["deleteDraftIfSavedSnapshotMatches"]>()
      .mockResolvedValueOnce({ reason: "write_failed", status: "unavailable" })
      .mockImplementation(memory.persistence.deleteDraftIfSavedSnapshotMatches);
    const saveNote = vi.fn(createApi().saveNote);
    const store = createLoadedStore({
      api: createApi({ saveNote }),
      draftPersistence: {
        ...memory.persistence,
        deleteDraftIfSavedSnapshotMatches: deleteSaved,
      },
      recovery: "draft",
    });

    await store.getState().saveSelectedNote();
    expect(getEditor(store)).toMatchObject({
      draftDisposition: "cleanup_required",
      persistenceIssue: { retryAction: "retry_draft_cleanup" },
    });
    await expect(
      store.getState().flushPendingDraft("route_transition"),
    ).resolves.toMatchObject({
      failure: { reason: "write_failed", source: "persistence" },
      status: "block",
    });

    await store.getState().retryDraftPersistenceIssue();

    expect(getEditor(store)).toMatchObject({
      draftDisposition: "none",
      persistenceIssue: undefined,
    });
    expect(saveNote).toHaveBeenCalledOnce();
    expect(deleteSaved).toHaveBeenCalledTimes(2);
    expect(
      memory.read(readyClusterIdentity.clusterId, "index.md"),
    ).toBeUndefined();
  });
});

describe("successful Save queue cleanup retry", () => {
  it("retains the exact obligation after a coordinator rejection", async () => {
    const draft = createTestDraft({
      baseContentHash: "sha256-old",
      markdown: "# Home",
    });
    const memory = createMemoryDraftPersistence([draft]);
    const deleteSaved = vi
      .fn<DraftPersistence["deleteDraftIfSavedSnapshotMatches"]>()
      .mockRejectedValueOnce(new Error("queue task failed"))
      .mockImplementation(memory.persistence.deleteDraftIfSavedSnapshotMatches);
    const saveNote = vi.fn(createApi().saveNote);
    const store = createLoadedStore({
      api: createApi({ saveNote }),
      draftPersistence: {
        ...memory.persistence,
        deleteDraftIfSavedSnapshotMatches: deleteSaved,
      },
      recovery: "draft",
    });

    await store.getState().saveSelectedNote();
    expect(getEditor(store)).toMatchObject({
      draftDisposition: "cleanup_required",
      persistenceIssue: {
        failure: { reason: "queue_task_failed", source: "coordinator" },
        retryAction: "retry_draft_cleanup",
      },
    });

    await store.getState().retryDraftPersistenceIssue();

    expect(getEditor(store).draftDisposition).toBe("none");
    expect(saveNote).toHaveBeenCalledOnce();
    expect(deleteSaved).toHaveBeenCalledTimes(2);
  });
});

describe("cleanup retry conditional mismatch", () => {
  it("treats a newer durable record as safe without deleting or rewriting it", async () => {
    const deleteSaved = vi
      .fn<DraftPersistence["deleteDraftIfSavedSnapshotMatches"]>()
      .mockResolvedValueOnce({ reason: "write_failed", status: "unavailable" })
      .mockResolvedValueOnce({ status: "not_matching" });
    const writeDraft = vi.fn<DraftPersistence["writeDraft"]>(() =>
      Promise.resolve({ status: "written" }),
    );
    const store = createLoadedStore({
      draftPersistence: createPersistence({
        deleteDraftIfSavedSnapshotMatches: deleteSaved,
        writeDraft,
      }),
      recovery: "draft",
    });
    await store.getState().saveSelectedNote();

    await store.getState().retryDraftPersistenceIssue();

    expect(getEditor(store)).toMatchObject({
      draftDisposition: "generated_durable",
      persistenceIssue: undefined,
    });
    await expect(
      store.getState().flushPendingDraft("route_transition"),
    ).resolves.toEqual({ status: "continue" });
    expect(deleteSaved).toHaveBeenCalledTimes(2);
    expect(writeDraft).not.toHaveBeenCalled();
  });
});

describe("failed snapshot retry", () => {
  it("writes the retained immutable snapshot without recapturing newer live state", async () => {
    const writeDraft = vi
      .fn<DraftPersistence["writeDraft"]>()
      .mockResolvedValueOnce({
        reason: "quota_exceeded",
        status: "unavailable",
      })
      .mockResolvedValueOnce({ status: "written" });
    const store = createLoadedStore({
      draftPersistence: createPersistence({ writeDraft }),
    });
    publishSourceMarkdown(store, "# Exact failed snapshot");
    await store.getState().flushPendingDraft();
    expect(getEditor(store).persistenceIssue).toMatchObject({
      retryAction: "retry_draft_persistence",
    });

    store.setState((state) => {
      if (state.noteState.status !== "ready") {
        return state;
      }
      return {
        noteState: {
          editor: {
            ...state.noteState.editor,
            currentMarkdown: "# Newer live state",
          },
          status: "ready",
        },
      };
    });
    await store.getState().retryDraftPersistenceIssue();

    expect(writeDraft).toHaveBeenCalledTimes(2);
    expect(writeDraft.mock.calls[1]?.[0]).toEqual(
      writeDraft.mock.calls[0]?.[0],
    );
    expect(writeDraft.mock.calls[1]?.[0].markdown).toBe(
      "# Exact failed snapshot",
    );
    expect(getEditor(store).currentMarkdown).toBe("# Newer live state");
  });
});

describe("cleanup retry supersession", () => {
  it("drops an obsolete cleanup retry when a newer accepted edit owns recovery", async () => {
    const memory = createMemoryDraftPersistence([
      createTestDraft({ baseContentHash: "sha256-old", markdown: "# Home" }),
    ]);
    const deleteSaved = vi
      .fn<DraftPersistence["deleteDraftIfSavedSnapshotMatches"]>()
      .mockResolvedValueOnce({ reason: "write_failed", status: "unavailable" })
      .mockImplementation(memory.persistence.deleteDraftIfSavedSnapshotMatches);
    const store = createLoadedStore({
      draftPersistence: {
        ...memory.persistence,
        deleteDraftIfSavedSnapshotMatches: deleteSaved,
      },
      recovery: "draft",
    });
    await store.getState().saveSelectedNote();
    expect(getEditor(store).draftDisposition).toBe("cleanup_required");

    publishSourceMarkdown(store, "# Newer accepted edit");
    await store.getState().retryDraftPersistenceIssue();
    await store.getState().flushPendingDraft();

    expect(deleteSaved).toHaveBeenCalledOnce();
    expect(getEditor(store)).toMatchObject({
      currentMarkdown: "# Newer accepted edit",
      draftDisposition: "generated_durable",
      persistenceIssue: undefined,
    });
    expect(
      memory.read(readyClusterIdentity.clusterId, "index.md")?.markdown,
    ).toBe("# Newer accepted edit");
  });
});

function createPersistence(patch: Partial<DraftPersistence>): DraftPersistence {
  return {
    deleteDraft: () => Promise.resolve({ status: "absent" }),
    deleteDraftIfSavedSnapshotMatches: () =>
      Promise.resolve({ status: "absent" }),
    readDraft: (clusterId, noteId) =>
      Promise.resolve({ clusterId, noteId, status: "absent" }),
    writeDraft: () => Promise.resolve({ status: "written" }),
    ...patch,
  };
}

function getEditor(store: ReturnType<typeof createNoteBrowserStore>) {
  const state = store.getState().noteState;
  if (state.status !== "ready") {
    throw new Error("Expected a ready editor.");
  }
  return state.editor;
}
