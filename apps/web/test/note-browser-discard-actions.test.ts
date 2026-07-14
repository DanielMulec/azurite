import { describe, expect, it, vi } from "vitest";

import type { DraftPersistence } from "../src/persistence/draft-database.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createTestDraft,
  readyClusterIdentity,
} from "./note-browser-store-test-helpers.js";
import { loadTestRoute } from "./note-browser-route-test-helpers.js";

describe("terminal Discard", () => {
  it("deletes the record and reloads disk only for the exact owner", async () => {
    const memory = createMemoryDraftPersistence([createTestDraft()]);
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() =>
      Promise.resolve({
        clusterIdentity: readyClusterIdentity,
        note: createNote("index.md", "# Exact disk", "sha256-disk"),
      }),
    );
    const store = createLoadedStore({
      api: createApi({ readNote }),
      draftPersistence: memory.persistence,
      recovery: "draft",
    });

    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();

    expect(readNote).toHaveBeenCalledOnce();
    expect(
      memory.read(readyClusterIdentity.clusterId, "index.md"),
    ).toBeUndefined();
    expect(getEditor(store)).toMatchObject({
      currentMarkdown: "# Exact disk",
      draftDisposition: "none",
    });
  });
});

describe("failed terminal Discard", () => {
  it("restores the same editor under a fresh epoch after deletion failure", async () => {
    const memory = createMemoryDraftPersistence([createTestDraft()]);
    const deleteDraft = vi
      .fn<DraftPersistence["deleteDraft"]>()
      .mockResolvedValueOnce({ reason: "write_failed", status: "unavailable" })
      .mockImplementation(memory.persistence.deleteDraft);
    const store = createLoadedStore({
      draftPersistence: { ...memory.persistence, deleteDraft },
      recovery: "draft",
    });
    const original = getEditor(store);

    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();

    expect(getEditor(store)).toMatchObject({
      currentMarkdown: original.currentMarkdown,
      draftEpoch: 1,
      persistenceIssue: {
        clusterId: readyClusterIdentity.clusterId,
        operation: "discard",
        retryAction: "retry_discard",
      },
      sessionKey: original.sessionKey,
    });
    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();
    expect(getEditor(store)).toMatchObject({
      currentMarkdown: "# Home",
      draftDisposition: "none",
    });
    expect(deleteDraft).toHaveBeenCalledTimes(2);
  });
});

describe("future-version terminal Discard", () => {
  it("preserves a future record discovered transactionally and removes Discard", async () => {
    const memory = createMemoryDraftPersistence([createTestDraft()]);
    const deleteDraft = vi.fn<DraftPersistence["deleteDraft"]>(() =>
      Promise.resolve({ schemaVersion: 7, status: "preserved_unknown" }),
    );
    const readNote = vi.fn(createApi().readNote);
    const store = createLoadedStore({
      api: createApi({ readNote }),
      draftPersistence: { ...memory.persistence, deleteDraft },
      recovery: "draft",
    });

    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();

    expect(getEditor(store)).toMatchObject({
      draftDisposition: "preserved_unknown",
      draftEpoch: 1,
      preservedSchemaVersion: 7,
    });
    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();
    expect(deleteDraft).toHaveBeenCalledOnce();
    expect(readNote).not.toHaveBeenCalled();
  });
});

describe("superseded terminal Discard", () => {
  it("does not reload through a replacement owner after deletion settles", async () => {
    const deletion =
      createDeferred<ReturnType<DraftPersistence["deleteDraft"]>>();
    const memory = createMemoryDraftPersistence([createTestDraft()]);
    const readNote = vi.fn(createApi().readNote);
    const store = createLoadedStore({
      api: createApi({ readNote }),
      draftPersistence: {
        ...memory.persistence,
        deleteDraft: () => deletion.promise,
      },
      recovery: "draft",
    });
    const discard = store.getState().discardCurrentDraft();
    await vi.waitFor(() => {
      expect(getEditor(store).draftEpoch).toBe(0);
    });
    const replacement = createLoadedStore({
      note: createNote("Projects/azurite.md", "# Project", "sha256-project"),
    }).getState().noteState;
    if (replacement.status !== "ready") {
      throw new Error("Expected a replacement editor.");
    }
    store.setState({
      noteState: {
        editor: { ...replacement.editor, sessionKey: "project-session" },
        status: "ready",
      },
      selectedNoteId: "Projects/azurite.md",
    });
    deletion.resolve({ status: "deleted" });

    await expect(discard).resolves.toBeUndefined();
    expect(readNote).not.toHaveBeenCalled();
    expect(getEditor(store).note.id).toBe("Projects/azurite.md");
  });

  it("does not apply a stale result to a newer epoch under the same owner", async () => {
    const deletion =
      createDeferred<ReturnType<DraftPersistence["deleteDraft"]>>();
    const memory = createMemoryDraftPersistence([createTestDraft()]);
    const readNote = vi.fn(createApi().readNote);
    const store = createLoadedStore({
      api: createApi({ readNote }),
      draftPersistence: {
        ...memory.persistence,
        deleteDraft: () => deletion.promise,
      },
      recovery: "draft",
    });
    const discard = store.getState().discardCurrentDraft();
    const original = getEditor(store);
    store.setState({
      noteState: {
        editor: {
          ...original,
          currentMarkdown: "# New epoch authority",
          draftEpoch: original.draftEpoch + 1,
        },
        status: "ready",
      },
    });
    deletion.resolve({ status: "deleted" });

    await expect(discard).resolves.toBeUndefined();
    expect(readNote).not.toHaveBeenCalled();
    expect(getEditor(store)).toMatchObject({
      currentMarkdown: "# New epoch authority",
      draftEpoch: 1,
      sessionKey: original.sessionKey,
    });
  });
});

describe("missing-note terminal Discard", () => {
  it("restores a failed missing-note owner with an exact retry issue", async () => {
    const draft = createTestDraft({ noteId: "deleted.md" });
    const memory = createMemoryDraftPersistence([draft]);
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: {
        ...memory.persistence,
        deleteDraft: () =>
          Promise.resolve({ reason: "quota_exceeded", status: "unavailable" }),
      },
    });
    await loadTestRoute(store, "deleted.md");

    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();
    expect(store.getState().noteState).toMatchObject({
      draftDisposition: "recovered",
      draftEpoch: 1,
      persistenceIssue: {
        failure: { reason: "quota_exceeded", source: "persistence" },
        retryAction: "retry_discard",
      },
      status: "missing-draft",
    });
  });
});

describe("protected missing-note recovery", () => {
  it("rejects a direct Discard call for a future-version record", async () => {
    const deleteDraft = vi.fn<DraftPersistence["deleteDraft"]>();
    const memory = createMemoryDraftPersistence([]);
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: { ...memory.persistence, deleteDraft },
    });
    store.setState({
      noteState: {
        draft: {
          editorMode: "markdown",
          markdown: "# Preserved by a newer build",
          updatedAt: "2026-07-08T10:00:00.000Z",
        },
        draftDisposition: "preserved_unknown",
        draftEpoch: 1,
        noteId: "deleted.md",
        persistenceIssue: undefined,
        preservedSchemaVersion: 7,
        renderedOwnerKey: "deleted.md:missing-draft:1",
        status: "missing-draft",
      },
    });

    await expect(
      store.getState().discardCurrentDraft(),
    ).resolves.toBeUndefined();

    expect(deleteDraft).not.toHaveBeenCalled();
    expect(store.getState().noteState).toMatchObject({
      draftDisposition: "preserved_unknown",
      preservedSchemaVersion: 7,
      status: "missing-draft",
    });
  });
});

function getEditor(store: ReturnType<typeof createLoadedStore>) {
  const state = store.getState().noteState;
  if (state.status !== "ready") {
    throw new Error("Expected a ready editor.");
  }
  return state.editor;
}
