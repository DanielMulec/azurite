import { describe, expect, it, vi } from "vitest";

import { markdownEquals } from "../src/domain/markdown-equality.js";
import {
  createApi,
  createLoadedStore,
  createMemoryDraftPersistence,
  createNote,
  createTestDraft,
  publishSourceMarkdown,
  readyClusterIdentity,
} from "./note-browser-store-test-helpers.js";
import { markdownEqualityCases } from "./markdown-fidelity-cases.js";

describe("shared Markdown equality helper", () => {
  it.each(markdownEqualityCases)(
    "$name has the contract result $equal",
    ({ current, equal, saved }) => {
      expect(markdownEquals(current, saved)).toBe(equal);
      expect(markdownEquals(saved, current)).toBe(equal);
    },
  );
});

describe("store dirty, draft, and defensive Save decisions", () => {
  it.each(markdownEqualityCases)(
    "$name agrees with the shared equality result",
    async ({ current, equal, saved }) => {
      const saveNote = vi.fn(createApi().saveNote);
      const drafts = createMemoryDraftPersistence();
      const store = createLoadedStore({
        api: createApi({ saveNote }),
        draftPersistence: drafts.persistence,
        note: createNote("index.md", saved, "sha256-equality"),
      });

      publishSourceMarkdown(store, current);
      await store.getState().flushPendingDraft();

      expect(
        drafts.read(readyClusterIdentity.clusterId, "index.md") === undefined,
      ).toBe(equal);
      await store.getState().saveSelectedNote();
      expect(saveNote).toHaveBeenCalledTimes(equal ? 0 : 1);
    },
  );
});

describe("memory persistence saved-snapshot reconciliation", () => {
  it.each(markdownEqualityCases)(
    "$name consumes the same comparison contract",
    async ({ current, equal, saved }) => {
      const draft = createTestDraft({ markdown: current });
      const memory = createMemoryDraftPersistence([draft]);

      await expect(
        memory.persistence.deleteDraftIfSavedSnapshotMatches({
          baseContentHash: draft.baseContentHash,
          clusterId: draft.clusterId,
          markdown: saved,
          noteId: draft.noteId,
        }),
      ).resolves.toEqual({ status: equal ? "deleted" : "not_matching" });
    },
  );
});
