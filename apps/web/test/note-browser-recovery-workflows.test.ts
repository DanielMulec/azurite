import { describe, expect, it, vi } from "vitest";

import type { DraftPersistence } from "../src/persistence/draft-database.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import {
  createApi,
  createLoadedStore,
  createMemoryDraftPersistence,
  createTestDraft,
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
      store.getState().retryBrowserRecovery(),
    ).resolves.toMatchObject({
      disposition: "none",
      recordStatus: "absent",
      status: "resolved",
    });
    expect(getEditor(store)).toMatchObject({
      draftDisposition: "none",
      persistenceIssue: undefined,
    });
    expect(getEditor(store).sessionKey).not.toBe(previousOwner);
    expect(store.getState().committedRouteView).toMatchObject({
      renderedOwnerKey: getEditor(store).sessionKey,
    });
  });

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
    store.getState().updateDraftMarkdown("# Exact live edit");

    expect(getEditor(store).persistenceIssue?.retryAction).toBeUndefined();
    await expect(
      store.getState().retryBrowserRecovery(),
    ).resolves.toMatchObject({
      reason: "dirty_live_authority",
      status: "superseded",
    });
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
    store.getState().updateDraftMarkdown("# Save without touching future data");
    await store.getState().flushPendingDraft();
    await store.getState().saveSelectedNote();
    await store.getState().discardDraftAndReloadDiskVersion();

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

    await store.getState().retryDraftCleanup();

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
