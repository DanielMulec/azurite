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
  readyClusterIdentity,
  toSummary,
} from "./note-browser-store-test-helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("note browser store save race hardening", () => {
  it("keeps newer same-note edits dirty after an older save succeeds", async () => {
    const drafts = createMemoryDraftPersistence();
    const saveResponse = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const api = createApi({
      saveNote: vi.fn(() => saveResponse.promise),
    });
    const store = createLoadedStore({
      api,
      draftPersistence: drafts.persistence,
    });

    store.getState().updateDraftMarkdown("# Home\nSaved snapshot");
    await store.getState().flushPendingDraft();
    const save = store.getState().saveSelectedNote();
    store.getState().updateDraftMarkdown("# Home\nNewer edit");
    await store.getState().flushPendingDraft();
    saveResponse.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("index.md", "# Home\nSaved snapshot", "sha256-saved"),
    });
    await save;

    expect(api.saveNote).toHaveBeenCalledWith({
      expectedContentHash: "sha256-home",
      markdown: "# Home\nSaved snapshot",
      noteId: "index.md",
    });
    expect(store.getState().noteState).toMatchObject({
      editor: {
        baseContentHash: "sha256-saved",
        currentMarkdown: "# Home\nNewer edit",
        savedMarkdown: "# Home\nSaved snapshot",
        saveStatus: "idle",
      },
      status: "ready",
    });
    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      baseContentHash: "sha256-saved",
      markdown: "# Home\nNewer edit",
    });
  });

  it("does not mark newer same-note edits failed after an older save fails", async () => {
    const drafts = createMemoryDraftPersistence();
    const saveFailure = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const store = createLoadedStore({
      api: createApi({
        saveNote: vi.fn(() => saveFailure.promise),
      }),
      draftPersistence: drafts.persistence,
    });

    store.getState().updateDraftMarkdown("# Home\nWill fail");
    const save = store.getState().saveSelectedNote();
    store.getState().updateDraftMarkdown("# Home\nStill typing");
    await store.getState().flushPendingDraft();
    saveFailure.reject(new Error("Temporary save failure."));
    await save;

    expect(store.getState().noteState).toMatchObject({
      editor: {
        currentMarkdown: "# Home\nStill typing",
        saveStatus: "idle",
      },
      status: "ready",
    });
    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Home\nStill typing",
    });
  });

  it("persists the latest current draft when an older save conflicts", async () => {
    const drafts = createMemoryDraftPersistence();
    const saveConflict = createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
    const store = createLoadedStore({
      api: createApi({
        saveNote: vi.fn(() => saveConflict.promise),
      }),
      draftPersistence: drafts.persistence,
    });

    store.getState().updateDraftMarkdown("# Home\nOld save body");
    const save = store.getState().saveSelectedNote();
    store.getState().updateDraftMarkdown("# Home\nNewest draft");
    saveConflict.reject(
      new WebApiError("Changed on disk.", {
        code: apiErrorCodes.noteWriteConflict,
        statusCode: 409,
      }),
    );
    await save;

    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Home\nNewest draft",
    });
    expect(store.getState().noteState).toMatchObject({
      editor: {
        currentMarkdown: "# Home\nNewest draft",
        recovery: "none",
        saveStatus: "idle",
      },
      status: "ready",
    });
  });
});

describe("note browser store route hardening", () => {
  it("uses the latest route note after note-list loading resolves", async () => {
    const listResponse = createDeferred<ReturnType<NoteBrowserApi["listNotes"]>>();
    const home = createNote("index.md", "# Home", "sha256-home");
    const project = createNote(
      "Projects/azurite.md",
      "# Project",
      "sha256-project",
    );
    const store = createNoteBrowserStore({
      api: createApi({
        listNotes: () => listResponse.promise,
        readNote: (noteId) =>
          Promise.resolve({
            clusterIdentity: readyClusterIdentity,
            note: noteId === project.id ? project : home,
          }),
      }),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    const load = store.getState().loadNotes("index.md", navigation);
    await store
      .getState()
      .syncRouteNote("Projects/azurite.md", navigation);
    listResponse.resolve({
      clusterIdentity: readyClusterIdentity,
      notes: [toSummary(home), toSummary(project)],
    });
    await load;

    expect(navigation.replaceSelectedNote).not.toHaveBeenCalled();
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
    expect(store.getState().noteState).toMatchObject({
      editor: { note: { id: "Projects/azurite.md" } },
      status: "ready",
    });
  });
});
