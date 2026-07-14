import { afterEach, describe, expect, it, vi } from "vitest";

import { apiErrorCodes } from "@azurite/shared";
import { WebApiError } from "../src/api-client.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createSeededStore,
  createTestDraft,
  publishSourceMarkdown,
  readyClusterIdentity,
  toSummary,
  unavailableClusterIdentity,
} from "./note-browser-store-test-helpers.js";
import {
  loadTestRoute,
  selectTestNote,
} from "./note-browser-route-test-helpers.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("note browser store route loading", () => {
  it("loads notes with cluster identity and selects the router note", async () => {
    const api = createApi({
      readNote: (noteId) =>
        Promise.resolve({
          clusterIdentity: readyClusterIdentity,
          note: createNote(noteId, "# Project", "sha256-project"),
        }),
    });
    const store = createNoteBrowserStore({
      api,
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    await loadTestRoute(store, "Projects/azurite.md", navigation);

    expect(store.getState().clusterIdentity).toEqual(readyClusterIdentity);
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
    expect(store.getState().noteState).toMatchObject({
      editor: { currentMarkdown: "# Project" },
      status: "ready",
    });
    expect(navigation.replaceSelectedNote).not.toHaveBeenCalled();
  });

  it("auto-selects the first note with history replace when the route has no note", async () => {
    const api = createApi();
    const store = createNoteBrowserStore({
      api,
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    await loadTestRoute(store, undefined, navigation);

    expect(navigation.replaceSelectedNote).toHaveBeenCalledWith("index.md");
    expect(store.getState().selectedNoteId).toBe("index.md");
  });
});

describe("note browser store draft persistence", () => {
  it("flushes dirty markdown into durable draft state", async () => {
    const drafts = createMemoryDraftPersistence();
    const store = createLoadedStore({ draftPersistence: drafts.persistence });

    publishSourceMarkdown(store, "# Home\nUnsaved");
    await store.getState().flushPendingDraft();

    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Home\nUnsaved",
      noteId: "index.md",
    });
  });

  it("flushes one accepted draft and clears its timer for unmount", async () => {
    vi.useFakeTimers();
    const drafts = createMemoryDraftPersistence();
    const writeDraft = vi.fn(drafts.persistence.writeDraft);
    const store = createLoadedStore({
      draftPersistence: { ...drafts.persistence, writeDraft },
    });

    publishSourceMarkdown(store, "# Exact unmount draft");
    expect(vi.getTimerCount()).toBe(1);

    const flush = store.getState().flushPendingDraft("unmount");
    expect(vi.getTimerCount()).toBe(0);
    await expect(flush).resolves.toEqual({ status: "continue" });

    expect(writeDraft).toHaveBeenCalledOnce();
    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({ markdown: "# Exact unmount draft" });
  });
});

describe("note browser store save handling", () => {
  it("clears dirty and durable draft state after a successful save", async () => {
    const drafts = createMemoryDraftPersistence();
    const savedNote = createNote("index.md", "# Home\nSaved", "sha256-saved");
    const api = createApi({
      saveNote: vi.fn(() =>
        Promise.resolve({
          clusterIdentity: readyClusterIdentity,
          note: savedNote,
        }),
      ),
    });
    const store = createLoadedStore({
      api,
      draftPersistence: drafts.persistence,
    });

    publishSourceMarkdown(store, "# Home\nSaved");
    await store.getState().flushPendingDraft();
    await store.getState().saveSelectedNote();

    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toBeUndefined();
    expect(store.getState().noteState).toMatchObject({
      editor: {
        baseContentHash: "sha256-saved",
        currentMarkdown: "# Home\nSaved",
        draftDisposition: "none",
        savedMarkdown: "# Home\nSaved",
      },
      status: "ready",
    });
  });
});

describe("note browser store conflict handling", () => {
  it("persists the draft and enters conflict state on save conflict", async () => {
    const drafts = createMemoryDraftPersistence();
    const api = createApi({
      saveNote: vi.fn(() =>
        Promise.reject(
          new WebApiError("Changed on disk.", {
            code: apiErrorCodes.noteWriteConflict,
            statusCode: 409,
          }),
        ),
      ),
    });
    const store = createLoadedStore({
      api,
      draftPersistence: drafts.persistence,
    });

    publishSourceMarkdown(store, "# Home\nConflict draft");
    await store.getState().saveSelectedNote();

    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Home\nConflict draft",
    });
    expect(store.getState().noteState).toMatchObject({
      editor: { draftDisposition: "conflict", saveStatus: "conflict" },
      status: "ready",
    });
  });
});

describe("note browser store recovery actions", () => {
  it("discards a recovered conflict draft and reloads the disk version", async () => {
    const recoveredDraft = createTestDraft({
      baseContentHash: "sha256-old",
      markdown: "# Recovered",
    });
    const drafts = createMemoryDraftPersistence([recoveredDraft]);
    const api = createApi({
      readNote: () =>
        Promise.resolve({
          clusterIdentity: readyClusterIdentity,
          note: createNote("index.md", "# Disk", "sha256-new"),
        }),
    });
    const store = createLoadedStore({
      api,
      draftPersistence: drafts.persistence,
      note: createNote("index.md", "# Recovered", "sha256-new"),
      recovery: "conflict",
    });

    await store.getState().discardCurrentDraft();

    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toBeUndefined();
    expect(store.getState().noteState).toMatchObject({
      editor: { currentMarkdown: "# Disk", draftDisposition: "none" },
      status: "ready",
    });
  });
});

describe("note browser store async guards", () => {
  it("ignores stale selected-note responses", async () => {
    const slowHome = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const api = createApi({
      readNote: (noteId) => {
        if (noteId === "index.md") {
          return slowHome.promise;
        }

        return Promise.resolve({
          clusterIdentity: readyClusterIdentity,
          note: createNote(noteId, "# Project", "sha256-project"),
        });
      },
    });
    const store = createSeededStore({ api });

    const homeSelection = selectTestNote(store, "index.md");
    const projectSelection = selectTestNote(store, "Projects/azurite.md");
    await projectSelection;
    slowHome.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Slow home", "sha256-home-slow"),
    });
    await homeSelection;

    expect(store.getState().noteState).toMatchObject({
      editor: { note: { id: "Projects/azurite.md" } },
      status: "ready",
    });
  });

  it("flushes note A draft before selecting note B", async () => {
    const drafts = createMemoryDraftPersistence();
    const store = createLoadedStore({ draftPersistence: drafts.persistence });

    publishSourceMarkdown(store, "# Home\nBefore switch");
    await selectTestNote(store, "Projects/azurite.md");

    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Home\nBefore switch",
    });
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
  });
});

describe("note browser store missing notes", () => {
  it("recovers a draft for a missing URL note", async () => {
    const missingDraft = createTestDraft({
      markdown: "# Deleted but protected",
      noteId: "deleted.md",
    });
    const drafts = createMemoryDraftPersistence([missingDraft]);
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: drafts.persistence,
    });

    await loadTestRoute(store, "deleted.md", {
      replaceSelectedNote: vi.fn(),
    });

    expect(store.getState().noteState).toMatchObject({
      draft: {
        editorMode: "wysiwyg",
        markdown: "# Deleted but protected",
        updatedAt: "2026-07-08T10:00:00.000Z",
      },
      noteId: "deleted.md",
      status: "missing-draft",
    });
    expect(store.getState().noteState).toHaveProperty(
      "renderedOwnerKey",
      expect.any(String),
    );
  });
});

describe("note browser store degraded recovery", () => {
  it("keeps manual save usable when cluster identity is unavailable", async () => {
    const api = createApi({
      listNotes: () =>
        Promise.resolve({
          clusterIdentity: unavailableClusterIdentity,
          notes: [toSummary(createNote("index.md", "# Home", "sha256-home"))],
        }),
      readNote: () =>
        Promise.resolve({
          clusterIdentity: unavailableClusterIdentity,
          note: createNote("index.md", "# Home", "sha256-home"),
        }),
      saveNote: vi.fn(() =>
        Promise.resolve({
          clusterIdentity: unavailableClusterIdentity,
          note: createNote("index.md", "# Saved", "sha256-saved"),
        }),
      ),
    });
    const store = createNoteBrowserStore({
      api,
      draftPersistence: createMemoryDraftPersistence().persistence,
    });

    await loadTestRoute(store, "index.md", {
      replaceSelectedNote: vi.fn(),
    });
    publishSourceMarkdown(store, "# Saved");
    await store.getState().saveSelectedNote();

    expect(api.saveNote).toHaveBeenCalledTimes(1);
    expect(store.getState().draftRecoveryStatus).toMatchObject({
      reason: "cluster_identity_unavailable",
      status: "degraded",
    });
    expect(store.getState().noteState).toMatchObject({
      editor: { currentMarkdown: "# Saved" },
      status: "ready",
    });
  });
});

describe("note browser store draft write degradation", () => {
  it("surfaces failed draft writes as degraded recovery state", async () => {
    const store = createLoadedStore({
      draftPersistence: {
        deleteDraft: () => Promise.resolve({ status: "absent" }),
        deleteDraftIfSavedSnapshotMatches: () =>
          Promise.resolve({ status: "absent" }),
        readDraft: (clusterId, noteId) =>
          Promise.resolve({ clusterId, noteId, status: "absent" }),
        writeDraft: () =>
          Promise.resolve({
            reason: "write_failed",
            status: "unavailable",
          }),
      },
    });

    publishSourceMarkdown(store, "# Home\nNo durable write");
    await store.getState().flushPendingDraft();

    expect(getReadyEditor(store).persistenceIssue).toMatchObject({
      failure: { reason: "write_failed", source: "persistence" },
      operation: "content_write",
      retryAction: "retry_draft_persistence",
    });
  });
});

function getReadyEditor(store: ReturnType<typeof createLoadedStore>) {
  const noteState = store.getState().noteState;
  if (noteState.status !== "ready") {
    throw new Error("Expected a ready editor.");
  }
  return noteState.editor;
}
