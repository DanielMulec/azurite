import { describe, expect, it, vi } from "vitest";

import { noteOperationIdSchema, requestIdSchema } from "@azurite/shared";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createTestDraft,
  readyClusterIdentity,
  requireMockCall,
} from "./note-browser-store-test-helpers.js";
import {
  loadTestRoute,
  selectTestNote,
} from "./note-browser-route-test-helpers.js";

describe("note load operation ownership", () => {
  it("coalesces startup replacement and its same-note URL echo", async () => {
    const read = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() => read.promise);
    const store = createNoteBrowserStore({
      api: createApi({ readNote }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    const navigation = {
      replaceSelectedNote: vi.fn(),
    };

    const load = loadTestRoute(store, undefined, navigation);
    await vi.waitFor(() => {
      expect(readNote).toHaveBeenCalledOnce();
    });
    read.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Home", "sha256-home"),
    });
    await load;

    expect(navigation.replaceSelectedNote).toHaveBeenCalledOnce();
    expect(readNote).toHaveBeenCalledOnce();
    const metadata = requireMockCall(readNote.mock.calls, 0)[1];
    expect(requestIdSchema.safeParse(metadata.requestId).success).toBe(true);
    expect(
      noteOperationIdSchema.safeParse(metadata.noteOperationId).success,
    ).toBe(true);
  });
});

describe("overlapping note-list ownership", () => {
  it("joins active callers into one list request and one terminal result", async () => {
    const response = createDeferred<ReturnType<NoteBrowserApi["listNotes"]>>();
    const listNotes = vi.fn<NoteBrowserApi["listNotes"]>(
      () => response.promise,
    );
    const store = createNoteBrowserStore({
      api: createApi({ listNotes }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });

    const first = store.getState().ensureNotes();
    const second = store.getState().ensureNotes();
    expect(second).toBe(first);
    expect(listNotes).toHaveBeenCalledOnce();
    response.resolve({ clusterIdentity: readyClusterIdentity, notes: [] });

    await expect(first).resolves.toEqual({ noteIds: [], status: "ready" });
    await expect(second).resolves.toEqual({ noteIds: [], status: "ready" });
    expect(store.getState().notesState).toEqual({ data: [], status: "ready" });
  });
});

describe("explicit note reload ownership", () => {
  it("creates fresh operation and request IDs for explicit reloads", async () => {
    const drafts = createMemoryDraftPersistence([createTestDraft()]);
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() =>
      Promise.resolve({
        clusterIdentity: readyClusterIdentity,
        note: createNote("index.md", "# Home", "sha256-home"),
      }),
    );
    const store = createLoadedStore({
      api: createApi({ readNote }),
      draftPersistence: drafts.persistence,
      recovery: "draft",
    });

    await store.getState().discardDraftAndReloadDiskVersion();
    await drafts.persistence.writeDraft(createTestDraft());
    const noteState = store.getState().noteState;
    if (noteState.status !== "ready") {
      throw new Error("Expected the reloaded editor.");
    }
    store.setState({
      noteState: {
        editor: {
          ...noteState.editor,
          draftDisposition: "recovered",
          durableSnapshotKey: "recovered-record-2",
          lastSnapshotKey: "recovered-record-2",
        },
        status: "ready",
      },
    });
    await store.getState().discardDraftAndReloadDiskVersion();

    expect(readNote).toHaveBeenCalledTimes(2);
    expect(requireMockCall(readNote.mock.calls, 0)[1]).not.toEqual(
      requireMockCall(readNote.mock.calls, 1)[1],
    );
  });
});

describe("manual save operation ownership", () => {
  it("shares one same-note promise and keeps edits saving until completion", async () => {
    const deferred = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const saveNote = vi.fn<NoteBrowserApi["saveNote"]>(() => deferred.promise);
    const store = createLoadedStore({ api: createApi({ saveNote }) });
    store.getState().updateDraftMarkdown("# Snapshot");

    const first = store.getState().saveSelectedNote();
    store.getState().updateDraftMarkdown("# Newer edit");
    const second = store.getState().saveSelectedNote();

    expect(second).toBe(first);
    expect(saveNote).toHaveBeenCalledOnce();
    expect(store.getState().noteState).toMatchObject({
      editor: { currentMarkdown: "# Newer edit", saveStatus: "saving" },
    });
    const metadata = requireMockCall(saveNote.mock.calls, 0)[1];
    expect(requestIdSchema.safeParse(metadata.requestId).success).toBe(true);
    expect(
      noteOperationIdSchema.safeParse(metadata.noteOperationId).success,
    ).toBe(true);

    deferred.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Snapshot", "sha256-saved"),
    });
    await first;
    expect(store.getState().noteState).toMatchObject({
      editor: { currentMarkdown: "# Newer edit", saveStatus: "idle" },
    });
  });
});

describe("saved draft reconciliation after navigation", () => {
  it("deletes only an exact saved draft after navigation", async () => {
    const drafts = createMemoryDraftPersistence();
    const deferred = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const store = createLoadedStore({
      api: createApi({ saveNote: () => deferred.promise }),
      draftPersistence: drafts.persistence,
    });
    store.getState().updateDraftMarkdown("# Saved elsewhere");
    await store.getState().flushPendingDraft();
    const save = store.getState().saveSelectedNote();
    await selectTestNote(store, "Projects/azurite.md");

    deferred.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Saved elsewhere", "sha256-saved"),
    });
    await save;
    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toBeUndefined();
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
  });
});

describe("newer draft reconciliation after navigation", () => {
  it("preserves a different late draft after navigation", async () => {
    const drafts = createMemoryDraftPersistence();
    const deferred = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const store = createLoadedStore({
      api: createApi({ saveNote: () => deferred.promise }),
      draftPersistence: drafts.persistence,
    });
    store.getState().updateDraftMarkdown("# Saved snapshot");
    await store.getState().flushPendingDraft();
    const save = store.getState().saveSelectedNote();
    const savedDraft = drafts.read(readyClusterIdentity.clusterId, "index.md");
    if (savedDraft === undefined) {
      throw new Error("Expected the saved snapshot draft to exist.");
    }
    await drafts.persistence.writeDraft({
      ...savedDraft,
      markdown: "# Newer recovery",
      updatedAt: "2026-07-11T12:00:00.000Z",
    });
    await selectTestNote(store, "Projects/azurite.md");

    deferred.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Saved snapshot", "sha256-saved"),
    });
    await save;
    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Newer recovery",
    });
  });
});

describe("overlapping different-note saves", () => {
  it("allows different-note saves with independent correlation contexts", async () => {
    const homeSave = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const projectSave =
      createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const saveNote = vi.fn<NoteBrowserApi["saveNote"]>((input) =>
      input.noteId === "index.md" ? homeSave.promise : projectSave.promise,
    );
    const store = createLoadedStore({ api: createApi({ saveNote }) });
    store.getState().updateDraftMarkdown("# Home save");
    const first = store.getState().saveSelectedNote();
    await selectTestNote(store, "Projects/azurite.md");
    store.getState().updateDraftMarkdown("# Project save");
    const second = store.getState().saveSelectedNote();

    expect(saveNote).toHaveBeenCalledTimes(2);
    expect(requireMockCall(saveNote.mock.calls, 0)[1]).not.toEqual(
      requireMockCall(saveNote.mock.calls, 1)[1],
    );
    projectSave.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote(
        "Projects/azurite.md",
        "# Project save",
        "sha256-project-saved",
      ),
    });
    homeSave.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Home save", "sha256-home-saved"),
    });
    await Promise.all([first, second]);
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
  });
});
