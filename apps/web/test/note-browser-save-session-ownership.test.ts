import { describe, expect, it, vi } from "vitest";

import { apiErrorCodes } from "@azurite/shared";
import { WebApiError } from "../src/api-client.js";
import type { DraftPersistence } from "../src/persistence/draft-database.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createSeededStore,
  readyClusterIdentity,
} from "./note-browser-store-test-helpers.js";

const failureCases = [
  {
    error: new Error("Temporary save failure."),
    expectedRecovery: "none",
    expectedStatus: "failed",
    name: "failure",
  },
  {
    error: new WebApiError("Changed on disk.", {
      code: apiErrorCodes.noteWriteConflict,
      statusCode: 409,
    }),
    expectedRecovery: "conflict",
    expectedStatus: "conflict",
    name: "conflict",
  },
] as const;

describe("save failure post-persistence ownership", () => {
  it.each(failureCases)(
    "applies $name state to the latest exact-session edit",
    async ({ error, expectedRecovery, expectedStatus }) => {
      const drafts = createMemoryDraftPersistence();
      const writeStarted = createDeferred<undefined>();
      const releaseWrite = createDeferred<undefined>();
      let shouldPauseWrite = true;
      const draftPersistence: DraftPersistence = {
        ...drafts.persistence,
        writeDraft: async (draft) => {
          if (shouldPauseWrite) {
            shouldPauseWrite = false;
            writeStarted.resolve(undefined);
            await releaseWrite.promise;
          }
          return await drafts.persistence.writeDraft(draft);
        },
      };
      const saveResult =
        createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
      const store = createLoadedStore({
        api: createApi({ saveNote: () => saveResult.promise }),
        draftPersistence,
      });

      store.getState().updateDraftMarkdown("# Save snapshot");
      const save = store.getState().saveSelectedNote();
      store.getState().updateDraftMarkdown("# Edit before persistence");
      saveResult.reject(error);
      await writeStarted.promise;
      store.getState().updateDraftMarkdown("# Edit during persistence");
      releaseWrite.resolve(undefined);
      await save;

      expect(store.getState().noteState).toMatchObject({
        editor: {
          currentMarkdown: "# Edit during persistence",
          recovery: expectedRecovery,
          saveStatus: expectedStatus,
        },
        status: "ready",
      });
      await store.getState().flushPendingDraft();
      expect(
        drafts.read(readyClusterIdentity.clusterId, "index.md"),
      ).toMatchObject({ markdown: "# Edit during persistence" });
    },
  );
});

const staleResultCases = [
  {
    name: "success",
    settle: (
      deferred: ReturnType<
        typeof createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>
      >,
    ) => {
      deferred.resolve({
        clusterIdentity: readyClusterIdentity,
        note: createNote("index.md", "# Saved snapshot", "sha256-saved"),
      });
    },
  },
  {
    name: "failure",
    settle: (
      deferred: ReturnType<
        typeof createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>
      >,
    ) => {
      deferred.reject(new Error("Temporary save failure."));
    },
  },
  {
    name: "conflict",
    settle: (
      deferred: ReturnType<
        typeof createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>
      >,
    ) => {
      deferred.reject(
        new WebApiError("Changed on disk.", {
          code: apiErrorCodes.noteWriteConflict,
          statusCode: 409,
        }),
      );
    },
  },
] as const;

describe("save result editor-session ownership", () => {
  it.each(staleResultCases)(
    "does not apply stale $name to a freshly reopened same-note session",
    async ({ settle }) => {
      const saveResult =
        createDeferred<ReturnType<NoteBrowserApi["saveNote"]>>();
      const store = createSeededStore({
        api: createApi({ saveNote: vi.fn(() => saveResult.promise) }),
      });

      await store.getState().selectNote("index.md");
      store.getState().updateDraftMarkdown("# Saved snapshot");
      const originalSession = getReadySession(store.getState().noteState);
      const save = store.getState().saveSelectedNote();
      await store.getState().selectNote("Projects/azurite.md");
      await store.getState().selectNote("index.md");
      const reopenedSession = getReadySession(store.getState().noteState);
      expect(reopenedSession.sessionKey).not.toBe(originalSession.sessionKey);

      settle(saveResult);
      await save;

      expect(store.getState().noteState).toEqual({
        editor: reopenedSession,
        status: "ready",
      });
    },
  );
});

function getReadySession(
  noteState: ReturnType<
    ReturnType<typeof createSeededStore>["getState"]
  >["noteState"],
) {
  if (noteState.status !== "ready") {
    throw new Error("Expected a ready editor session.");
  }
  return noteState.editor;
}
