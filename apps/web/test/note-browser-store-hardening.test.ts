import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiErrorCodes,
  noteOperationIdSchema,
  requestIdSchema,
} from "@azurite/shared";
import { WebApiError } from "../src/api-client.js";
import type { DraftReadResult } from "../src/persistence/draft-database.js";
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
  toSummary,
} from "./note-browser-store-test-helpers.js";
import {
  loadTestRoute,
  selectTestNote,
  syncTestRoute,
} from "./note-browser-route-test-helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("note browser store stale save success hardening", () => {
  it("keeps newer same-note edits dirty after an older save succeeds", async () => {
    const drafts = createMemoryDraftPersistence();
    const saveResponse =
      createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
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

    const saveCall = requireMockCall(vi.mocked(api.saveNote).mock.calls, 0);
    expect(saveCall[0]).toEqual({
      expectedContentHash: "sha256-home",
      markdown: "# Home\nSaved snapshot",
      noteId: "index.md",
    });
    expect(
      noteOperationIdSchema.safeParse(saveCall[1].noteOperationId).success,
    ).toBe(true);
    expect(requestIdSchema.safeParse(saveCall[1].requestId).success).toBe(true);
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
});

describe("note browser store stale save failure hardening", () => {
  it("marks the latest same-note editor failed without restoring old text", async () => {
    const drafts = createMemoryDraftPersistence();
    const saveFailure =
      createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
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
        saveStatus: "failed",
      },
      status: "ready",
    });
    expect(
      drafts.read(readyClusterIdentity.clusterId, "index.md"),
    ).toMatchObject({
      markdown: "# Home\nStill typing",
    });
  });
});

describe("note browser store stale save conflict hardening", () => {
  it("persists the latest current draft when an older save conflicts", async () => {
    const drafts = createMemoryDraftPersistence();
    const saveConflict =
      createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
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
        recovery: "conflict",
        saveStatus: "conflict",
      },
      status: "ready",
    });
  });
});

describe("note browser store route hardening", () => {
  it("uses the latest route note after note-list loading resolves", async () => {
    const listResponse =
      createDeferred<ReturnType<NoteBrowserApi["listNotes"]>>();
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

    const load = store.getState().ensureNotes();
    listResponse.resolve({
      clusterIdentity: readyClusterIdentity,
      notes: [toSummary(home), toSummary(project)],
    });
    await load;
    await syncTestRoute(store, "Projects/azurite.md");

    expect(navigation.replaceSelectedNote).not.toHaveBeenCalled();
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
    expect(store.getState().noteState).toMatchObject({
      editor: { note: { id: "Projects/azurite.md" } },
      status: "ready",
    });
  });
});

describe("note browser store route application rollback", () => {
  it("restores the coherent predecessor after a terminal subscriber throws", async () => {
    const projectRead =
      createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi.fn<NoteBrowserApi["readNote"]>(
      () => projectRead.promise,
    );
    const store = createLoadedStore({ api: createApi({ readNote }) });
    const unsubscribe = store.subscribe((state) => {
      if (state.committedRouteView?.noteId === "Projects/azurite.md") {
        throw new Error("Injected terminal subscriber failure.");
      }
    });

    const navigation = selectTestNote(store, "Projects/azurite.md");
    await vi.waitFor(() => {
      expect(readNote).toHaveBeenCalledOnce();
    });
    store.getState().updateDraftMarkdown("# Home\nEdit during navigation");
    await store.getState().flushPendingDraft();
    projectRead.resolve({
      clusterIdentity: readyClusterIdentity,
      note: createNote("Projects/azurite.md", "# Project", "sha256-project"),
    });

    await expect(navigation).resolves.toEqual({
      reason: "store_apply_failed",
      status: "failed",
    });
    unsubscribe();
    expect(store.getState()).toMatchObject({
      committedRouteView: { noteId: "index.md", view: "ready" },
      noteState: {
        editor: {
          currentMarkdown: "# Home\nEdit during navigation",
          note: { id: "index.md" },
        },
        status: "ready",
      },
      selectedNoteId: "index.md",
    });
  });
});

describe("note browser store stale missing-note recovery hardening", () => {
  it("does not let stale missing-note draft recovery overwrite a newer note", async () => {
    const missingDraftLookup = createDeferred<DraftReadResult>();
    const home = createNote("index.md", "# Home", "sha256-home");
    const project = createNote(
      "Projects/azurite.md",
      "# Project",
      "sha256-project",
    );
    const store = createNoteBrowserStore({
      api: createApi({
        listNotes: () =>
          Promise.resolve({
            clusterIdentity: readyClusterIdentity,
            notes: [toSummary(home), toSummary(project)],
          }),
        readNote: (noteId) =>
          Promise.resolve({
            clusterIdentity: readyClusterIdentity,
            note: noteId === project.id ? project : home,
          }),
      }),
      draftPersistence: {
        deleteDraft: () => Promise.resolve({ status: "ok" }),
        deleteDraftIfSavedSnapshotMatches: () =>
          Promise.resolve({ status: "ok" }),
        readDraft: (_clusterId, noteId) =>
          noteId === "missing.md"
            ? missingDraftLookup.promise
            : Promise.resolve({ draft: undefined, status: "ok" }),
        writeDraft: () => Promise.resolve({ status: "ok" }),
      },
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    await loadTestRoute(store, undefined, navigation);
    const missingSync = syncTestRoute(store, "missing.md");
    const projectSync = syncTestRoute(store, "Projects/azurite.md");
    await projectSync;
    missingDraftLookup.resolve({ draft: undefined, status: "ok" });
    await missingSync;

    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
    expect(store.getState().noteState).toMatchObject({
      editor: { note: { id: "Projects/azurite.md" } },
      status: "ready",
    });
  });
});

describe("note browser store stale missing-note degradation hardening", () => {
  it("does not let stale missing-note draft failures degrade the current note", async () => {
    const missingDraftLookup = createDeferred<DraftReadResult>();
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: {
        deleteDraft: () => Promise.resolve({ status: "ok" }),
        deleteDraftIfSavedSnapshotMatches: () =>
          Promise.resolve({ status: "ok" }),
        readDraft: (_clusterId, noteId) =>
          noteId === "missing.md"
            ? missingDraftLookup.promise
            : Promise.resolve({ draft: undefined, status: "ok" }),
        writeDraft: () => Promise.resolve({ status: "ok" }),
      },
    });
    const navigation = { replaceSelectedNote: vi.fn() };

    await loadTestRoute(store, undefined, navigation);
    const missingSync = syncTestRoute(store, "missing.md");
    const projectSync = syncTestRoute(store, "Projects/azurite.md");
    await projectSync;
    missingDraftLookup.resolve({
      reason: "database_unavailable",
      status: "unavailable",
    });
    await missingSync;

    expect(store.getState().draftRecoveryStatus).toEqual({
      status: "available",
    });
    expect(store.getState().selectedNoteId).toBe("Projects/azurite.md");
    expect(store.getState().noteState.status).toBe("ready");
  });
});

describe("note browser store current missing-note recovery", () => {
  it("still shows a missing route note when no matching draft exists", async () => {
    const store = createNoteBrowserStore({
      api: createApi(),
      draftPersistence: createMemoryDraftPersistence().persistence,
    });

    await loadTestRoute(store, "missing.md", {
      replaceSelectedNote: vi.fn(),
    });

    expect(store.getState().selectedNoteId).toBe("missing.md");
    expect(store.getState().noteState).toEqual({
      noteId: "missing.md",
      status: "missing",
    });
  });
});
