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
} from "../src/persistence/draft-records.js";

const clusterId = "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793";
const databases: AzuriteBrowserDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.map((database) => database.delete()));
  databases.length = 0;
});

describe("transactional direct mutation outcomes", () => {
  it("distinguishes absent, deleted, and invalid-deleted records", async () => {
    const { database, persistence } = createTestPersistence();
    const valid = createDraft("valid.md");
    const invalidId = createDraftRecordId(clusterId, "invalid.md");
    await persistence.writeDraft(valid);
    await rawDrafts(database).put(
      { clusterId, id: invalidId, noteId: "invalid.md", schemaVersion: 1 },
      invalidId,
    );

    await expect(
      persistence.deleteDraft(clusterId, "absent.md"),
    ).resolves.toEqual({ status: "absent" });
    await expect(
      persistence.deleteDraft(clusterId, "valid.md"),
    ).resolves.toEqual({ status: "deleted" });
    await expect(
      persistence.deleteDraft(clusterId, "invalid.md"),
    ).resolves.toEqual({
      reason: "validation_failed",
      status: "invalid_deleted",
    });
  });
});

describe("transactional conditional mutation outcomes", () => {
  it("distinguishes absent, invalid, mismatching, and matching records", async () => {
    const { database, persistence } = createTestPersistence();
    const matching = createDraft("matching.md");
    const different = createDraft("different.md", "# Newer");
    const invalidId = createDraftRecordId(clusterId, "invalid.md");
    await persistence.writeDraft(matching);
    await persistence.writeDraft(different);
    await rawDrafts(database).put(
      { id: invalidId, schemaVersion: 1 },
      invalidId,
    );

    await expect(
      deleteSaved({ markdown: "# Draft", noteId: "absent.md", persistence }),
    ).resolves.toEqual({ status: "absent" });
    await expect(
      deleteSaved({ markdown: "# Draft", noteId: "invalid.md", persistence }),
    ).resolves.toEqual({
      reason: "validation_failed",
      status: "invalid_deleted",
    });
    await expect(
      deleteSaved({ markdown: "# Draft", noteId: "different.md", persistence }),
    ).resolves.toEqual({ status: "not_matching" });
    await expect(
      deleteSaved({ markdown: "# Draft", noteId: "matching.md", persistence }),
    ).resolves.toEqual({ status: "deleted" });
  });
});

describe("future-version mutation protection", () => {
  it("preserves the raw value across read, content/mode write, cleanup, and Discard", async () => {
    const { database, persistence } = createTestPersistence();
    const noteId = "future.md";
    const id = createDraftRecordId(clusterId, noteId);
    const future = {
      baseContentHash: "sha256-future",
      clusterId,
      editorMode: "future-mode",
      id,
      markdown: "# Future payload\n",
      noteId,
      schemaVersion: 7,
      updatedAt: "2030-01-01T00:00:00.000Z",
      futureMetadata: { opaque: true },
    };
    await rawDrafts(database).put(future, id);

    await expect(
      persistence.readDraft(clusterId, noteId),
    ).resolves.toMatchObject({
      schemaVersion: 7,
      status: "preserved_unknown",
    });
    await expect(
      persistence.writeDraft(createDraft(noteId, "# Older build write")),
    ).resolves.toEqual({ schemaVersion: 7, status: "preserved_unknown" });
    await expect(
      deleteSaved({
        baseContentHash: "sha256-future",
        markdown: "# Future payload\n",
        noteId,
        persistence,
      }),
    ).resolves.toEqual({ schemaVersion: 7, status: "preserved_unknown" });
    await expect(persistence.deleteDraft(clusterId, noteId)).resolves.toEqual({
      schemaVersion: 7,
      status: "preserved_unknown",
    });
    await expect(rawDrafts(database).get(id)).resolves.toEqual(future);
  });
});

describe("mutation unavailability", () => {
  it("returns exact unavailable outcomes for direct and conditional deletion", async () => {
    const draft = createDraft("blocked.md");
    const persistence = createDraftPersistence(
      createBrokenDeleteDatabase(draft, namedError("QuotaExceededError")),
    );

    await expect(
      persistence.deleteDraft(clusterId, draft.noteId),
    ).resolves.toEqual({ reason: "quota_exceeded", status: "unavailable" });
    await expect(
      deleteSaved({
        markdown: draft.markdown,
        noteId: draft.noteId,
        persistence,
      }),
    ).resolves.toEqual({ reason: "quota_exceeded", status: "unavailable" });
  });
});

function createTestPersistence(): {
  readonly database: AzuriteBrowserDatabase;
  readonly persistence: ReturnType<typeof createDraftPersistence>;
} {
  const database = new AzuriteBrowserDatabase(
    `azurite-draft-mutation-test-${crypto.randomUUID()}`,
  );
  databases.push(database);
  return { database, persistence: createDraftPersistence(database) };
}

function createDraft(noteId: string, markdown = "# Draft") {
  return createDraftRecord({
    baseContentHash: "sha256-base",
    clusterId,
    editorMode: "wysiwyg",
    markdown,
    noteId,
    updatedAt: "2026-07-08T10:00:00.000Z",
  });
}

function deleteSaved(input: {
  readonly baseContentHash?: string;
  readonly markdown: string;
  readonly noteId: string;
  readonly persistence: ReturnType<typeof createDraftPersistence>;
}) {
  return input.persistence.deleteDraftIfSavedSnapshotMatches({
    baseContentHash: input.baseContentHash ?? "sha256-base",
    clusterId,
    markdown: input.markdown,
    noteId: input.noteId,
  });
}

function rawDrafts(database: AzuriteBrowserDatabase): Table<unknown, string> {
  return database.table("drafts");
}

function createBrokenDeleteDatabase(
  draft: ReturnType<typeof createDraft>,
  error: Error,
): AzuriteBrowserDatabase {
  return {
    drafts: {
      delete: () => Promise.reject(error),
      get: () => Promise.resolve(draft),
    },
    transaction: (
      _mode: string,
      _table: unknown,
      callback: () => Promise<unknown>,
    ) => callback(),
  } as unknown as AzuriteBrowserDatabase;
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}
