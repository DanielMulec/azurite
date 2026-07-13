// @vitest-environment jsdom

import "fake-indexeddb/auto";
import type { Table } from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  AzuriteBrowserDatabase,
  createDraftPersistence,
} from "../src/persistence/draft-database.js";
import {
  createDraftRecord,
  createDraftRecordId,
  type DraftRecord,
} from "../src/persistence/draft-records.js";
import { markdownEqualityCases } from "./markdown-fidelity-cases.js";

const clusterId = "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793";
const otherClusterId = "a0c11d04-bc50-4d48-a564-a4a9c21edb28";
const noteId = "index.md";
const testDatabases: AzuriteBrowserDatabase[] = [];

afterEach(async () => {
  await Promise.all(testDatabases.map((database) => database.delete()));
  testDatabases.length = 0;
});

describe("draft database current records", () => {
  it("saves and loads valid draft records", async () => {
    const { persistence } = createTestPersistence();
    const draft = createTestDraft({ markdown: "# Unsaved" });

    await expect(persistence.writeDraft(draft)).resolves.toEqual({
      status: "written",
    });

    await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual({
      draft,
      status: "found_current",
    });
  });

  it("rejects and clears invalid current-version records", async () => {
    const { database, persistence } = createTestPersistence();
    const draftId = createDraftRecordId(clusterId, noteId);
    await putRawDraft(database, {
      id: draftId,
      schemaVersion: 1,
      clusterId,
      noteId,
    });

    await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual({
      clusterId,
      noteId,
      reason: "validation_failed",
      status: "invalid_deleted",
    });
    await expect(database.drafts.get(draftId)).resolves.toBeUndefined();
  });

  it("requires schema versions and clears records that omit them", async () => {
    const { database, persistence } = createTestPersistence();
    const draftId = createDraftRecordId(clusterId, noteId);
    await putRawDraft(database, {
      id: draftId,
      clusterId,
      markdown: "# Missing schema version",
      noteId,
    });

    await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual({
      clusterId,
      noteId,
      reason: "validation_failed",
      status: "invalid_deleted",
    });
    await expect(database.drafts.get(draftId)).resolves.toBeUndefined();
  });
});

describe("draft database note ID validation", () => {
  it("rejects and clears current-version records with unsafe note IDs", async () => {
    const { database, persistence } = createTestPersistence();
    const unsafeNoteId = "../secret.md";
    const draftId = createDraftRecordId(clusterId, unsafeNoteId);
    await putRawDraft(database, {
      baseContentHash: "sha256-base",
      clusterId,
      editorMode: "wysiwyg",
      id: draftId,
      markdown: "# Unsafe",
      noteId: unsafeNoteId,
      schemaVersion: 1,
      updatedAt: "2026-07-08T10:00:00.000Z",
    });

    await expect(
      persistence.readDraft(clusterId, unsafeNoteId),
    ).resolves.toEqual({
      clusterId,
      noteId: unsafeNoteId,
      reason: "validation_failed",
      status: "invalid_deleted",
    });
    await expect(database.drafts.get(draftId)).resolves.toBeUndefined();
  });
});

describe("draft database future records", () => {
  it("ignores and preserves unknown future-version records", async () => {
    const { database, persistence } = createTestPersistence();
    const draftId = createDraftRecordId(clusterId, noteId);
    const futureDraft = {
      baseContentHash: "sha256-future",
      clusterId,
      editorMode: "wysiwyg",
      id: draftId,
      markdown: "# Future draft",
      noteId,
      schemaVersion: 2,
      updatedAt: "2026-07-08T10:00:00.000Z",
    };
    await putRawDraft(database, futureDraft);

    await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual({
      clusterId,
      noteId,
      schemaVersion: 2,
      status: "preserved_unknown",
    });
    await expect(rawDrafts(database).get(draftId)).resolves.toEqual(
      futureDraft,
    );
  });
});

describe("draft database scoping", () => {
  it("scopes drafts by cluster ID and note ID", async () => {
    const { persistence } = createTestPersistence();
    const draft = createTestDraft({ markdown: "# Cluster A" });
    const sameNoteOtherCluster = createTestDraft({
      clusterId: otherClusterId,
      markdown: "# Cluster B",
    });
    const sameClusterOtherNote = createTestDraft({
      markdown: "# Other note",
      noteId: "other.md",
    });

    await persistence.writeDraft(draft);
    await persistence.writeDraft(sameNoteOtherCluster);
    await persistence.writeDraft(sameClusterOtherNote);
    await persistence.deleteDraft(clusterId, noteId);

    await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual({
      clusterId,
      noteId,
      status: "absent",
    });
    await expect(
      persistence.readDraft(otherClusterId, noteId),
    ).resolves.toEqual({
      draft: sameNoteOtherCluster,
      status: "found_current",
    });
    await expect(persistence.readDraft(clusterId, "other.md")).resolves.toEqual(
      {
        draft: sameClusterOtherNote,
        status: "found_current",
      },
    );
  });
});

describe("successful-save draft reconciliation", () => {
  it.each(markdownEqualityCases)(
    "$name consumes the shared exact-text contract",
    async ({ current, equal, saved }) => {
      const { persistence } = createTestPersistence();
      const draft = createTestDraft({ markdown: current });
      await persistence.writeDraft(draft);

      await expect(
        persistence.deleteDraftIfSavedSnapshotMatches({
          baseContentHash: draft.baseContentHash,
          clusterId,
          markdown: saved,
          noteId,
        }),
      ).resolves.toEqual({ status: equal ? "deleted" : "not_matching" });
      await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual(
        equal
          ? { clusterId, noteId, status: "absent" }
          : { draft, status: "found_current" },
      );
    },
  );

  it.each([
    [{ baseContentHash: "different" }, "# Draft"],
    [{}, "# Newer draft"],
  ])("preserves a differing record", async (patch, savedMarkdown) => {
    const { persistence } = createTestPersistence();
    const draft = createTestDraft(patch);
    await persistence.writeDraft(draft);

    await expect(
      persistence.deleteDraftIfSavedSnapshotMatches({
        baseContentHash: "sha256-base",
        clusterId,
        markdown: savedMarkdown,
        noteId,
      }),
    ).resolves.toEqual({ status: "not_matching" });
    await expect(persistence.readDraft(clusterId, noteId)).resolves.toEqual({
      draft,
      status: "found_current",
    });
  });
});

describe("draft database failure reporting", () => {
  it("reports database, quota, blocked-upgrade, and write failures", async () => {
    await expect(
      createBrokenPersistence("get", namedError("MissingAPIError")).readDraft(
        clusterId,
        noteId,
      ),
    ).resolves.toEqual({
      clusterId,
      noteId,
      reason: "database_unavailable",
      status: "unavailable",
    });
    await expect(
      createBrokenPersistence(
        "put",
        namedError("QuotaExceededError"),
      ).writeDraft(createTestDraft()),
    ).resolves.toEqual({
      reason: "quota_exceeded",
      status: "unavailable",
    });
    await expect(
      createBrokenPersistence("put", namedError("BlockedError")).writeDraft(
        createTestDraft(),
      ),
    ).resolves.toEqual({
      reason: "blocked_upgrade",
      status: "unavailable",
    });
    await expect(
      createBrokenPersistence("put", new Error("write failed")).writeDraft(
        createTestDraft(),
      ),
    ).resolves.toEqual({
      reason: "write_failed",
      status: "unavailable",
    });
  });
});

function createTestPersistence(): {
  readonly database: AzuriteBrowserDatabase;
  readonly persistence: ReturnType<typeof createDraftPersistence>;
} {
  const database = new AzuriteBrowserDatabase(
    `azurite-draft-test-${crypto.randomUUID()}`,
  );
  testDatabases.push(database);

  return {
    database,
    persistence: createDraftPersistence(database),
  };
}

function createTestDraft(
  patch: Partial<Parameters<typeof createDraftRecord>[0]> = {},
): DraftRecord {
  return createDraftRecord({
    baseContentHash: "sha256-base",
    clusterId,
    editorMode: "wysiwyg",
    markdown: "# Draft",
    noteId,
    updatedAt: "2026-07-08T10:00:00.000Z",
    ...patch,
  });
}

async function putRawDraft(
  database: AzuriteBrowserDatabase,
  draft: unknown,
): Promise<void> {
  await rawDrafts(database).put(draft, getRawDraftId(draft));
}

function rawDrafts(database: AzuriteBrowserDatabase): Table<unknown, string> {
  return database.table("drafts");
}

function getRawDraftId(draft: unknown): string {
  return readRawDraftId(draft) ?? crypto.randomUUID();
}

function readRawDraftId(draft: unknown): string | undefined {
  if (!hasRawDraftId(draft)) {
    return undefined;
  }

  return String(draft.id);
}

function hasRawDraftId(draft: unknown): draft is { readonly id: unknown } {
  if (!isObject(draft)) {
    return false;
  }

  return "id" in draft;
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function createBrokenPersistence(
  method: "get" | "put",
  error: Error,
): ReturnType<typeof createDraftPersistence> {
  return createDraftPersistence({
    drafts: {
      delete: () => Promise.resolve(),
      get: () =>
        method === "get" ? Promise.reject(error) : Promise.resolve(undefined),
      put: () => (method === "put" ? Promise.reject(error) : Promise.resolve()),
    },
    transaction: (
      _mode: string,
      _table: unknown,
      callback: () => Promise<unknown>,
    ) => callback(),
  } as unknown as AzuriteBrowserDatabase);
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}
