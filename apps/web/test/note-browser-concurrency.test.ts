import { describe, expect, it, vi } from "vitest";

import {
  noteOperationIdSchema,
  requestIdSchema,
  type ListNotesResponse,
} from "@azurite/shared";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  readyClusterIdentity,
  requireMockCall,
} from "./note-browser-store-test-helpers.js";

describe("note load operation ownership", () => {
  it("coalesces startup replacement and its same-note URL echo", async () => {
    const read = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() => read.promise);
    const store = createNoteBrowserStore({
      api: createApi({ readNote }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    let routeEcho: Promise<void> | undefined;
    const navigation = {
      replaceSelectedNote: vi.fn((noteId: string) => {
        routeEcho = store.getState().syncRouteNote(noteId, navigation);
      }),
    };

    const load = store.getState().loadNotes(undefined, navigation);
    await vi.waitFor(() => {
      expect(readNote).toHaveBeenCalledOnce();
    });
    read.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Home", "sha256-home"),
    });
    await load;
    await routeEcho;

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
  it("keeps newer list success and failure state in both stale orderings", async () => {
    const first = createDeferred<ListNotesResponse>();
    const second = createDeferred<ListNotesResponse>();
    const listNotes = vi
      .fn<NoteBrowserApi["listNotes"]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const store = createNoteBrowserStore({
      api: createApi({ listNotes }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    const older = store.getState().loadNotes(undefined, navigation);
    const newer = store.getState().loadNotes(undefined, navigation);
    second.resolve({ clusterIdentity: readyClusterIdentity, notes: [] });
    await newer;
    first.reject(new Error("stale failure"));
    await older;
    expect(store.getState().notesState).toEqual({ data: [], status: "ready" });

    const third = createDeferred<ListNotesResponse>();
    const fourth = createDeferred<ListNotesResponse>();
    listNotes
      .mockReturnValueOnce(third.promise)
      .mockReturnValueOnce(fourth.promise);
    const olderSuccess = store.getState().loadNotes(undefined, navigation);
    const newerFailure = store.getState().loadNotes(undefined, navigation);
    fourth.reject(new Error("current failure"));
    await newerFailure;
    third.resolve({ clusterIdentity: readyClusterIdentity, notes: [] });
    await olderSuccess;
    expect(store.getState().notesState).toMatchObject({
      message: "current failure",
      status: "error",
    });
    expect(requireMockCall(listNotes.mock.calls, 0)[0].requestId).not.toBe(
      requireMockCall(listNotes.mock.calls, 1)[0].requestId,
    );
  });
});

describe("explicit note reload ownership", () => {
  it("creates fresh operation and request IDs for explicit reloads", async () => {
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(() =>
      Promise.resolve({
        clusterIdentity: readyClusterIdentity,
        note: createNote("index.md", "# Home", "sha256-home"),
      }),
    );
    const store = createLoadedStore({ api: createApi({ readNote }) });

    await store.getState().discardDraftAndReloadDiskVersion();
    await store.getState().discardDraftAndReloadDiskVersion();

    expect(readNote).toHaveBeenCalledTimes(2);
    expect(readNote.mock.calls[0]?.[1]).not.toEqual(
      readNote.mock.calls[1]?.[1],
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
    await store.getState().selectNote("Projects/azurite.md");

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
    await store.getState().selectNote("Projects/azurite.md");

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
    await store.getState().selectNote("Projects/azurite.md");
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
