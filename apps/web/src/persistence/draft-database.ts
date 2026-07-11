import Dexie, { type Table } from "dexie";

import {
  createDraftRecordId,
  type DraftRecord,
  validateStoredDraftRecord,
} from "./draft-records.js";

/** User-visible reason durable browser draft recovery is unavailable. */
export type DraftPersistenceUnavailableReason =
  | "blocked_upgrade"
  | "database_unavailable"
  | "quota_exceeded"
  | "validation_failed"
  | "write_failed";

/** Result of looking up one durable browser draft. */
export type DraftReadResult =
  | {
      readonly draft: DraftRecord | undefined;
      readonly status: "ok";
    }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Result of writing or clearing one durable browser draft. */
export type DraftWriteResult =
  | { readonly status: "ok" }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Snapshot that a successful save may remove only when it still matches. */
export type SavedDraftSnapshot = {
  readonly baseContentHash: string;
  readonly clusterId: string;
  readonly markdown: string;
  readonly noteId: string;
};

/** Dexie database that owns Azurite's browser-local durable state. */
export class AzuriteBrowserDatabase extends Dexie {
  drafts!: Table<DraftRecord, string>;

  constructor(databaseName = "azurite-browser-state") {
    super(databaseName);
    this.version(1).stores({
      drafts: "id,[clusterId+noteId],updatedAt",
    });
  }
}

/** Persistence boundary used by the note browser store. */
export type DraftPersistence = {
  readonly deleteDraft: (
    clusterId: string,
    noteId: string,
  ) => Promise<DraftWriteResult>;
  readonly deleteDraftIfSavedSnapshotMatches: (
    snapshot: SavedDraftSnapshot,
  ) => Promise<DraftWriteResult>;
  readonly readDraft: (
    clusterId: string,
    noteId: string,
  ) => Promise<DraftReadResult>;
  readonly writeDraft: (draft: DraftRecord) => Promise<DraftWriteResult>;
};

const defaultDatabase = new AzuriteBrowserDatabase();

/** Creates the IndexedDB-backed draft persistence boundary. */
export function createDraftPersistence(
  database: AzuriteBrowserDatabase = defaultDatabase,
): DraftPersistence {
  return {
    deleteDraft: (clusterId, noteId) =>
      deleteDraft(database, clusterId, noteId),
    deleteDraftIfSavedSnapshotMatches: (snapshot) =>
      deleteDraftIfSavedSnapshotMatches(database, snapshot),
    readDraft: (clusterId, noteId) => readDraft(database, clusterId, noteId),
    writeDraft: (draft) => writeDraft(database, draft),
  };
}

async function deleteDraftIfSavedSnapshotMatches(
  database: AzuriteBrowserDatabase,
  snapshot: SavedDraftSnapshot,
): Promise<DraftWriteResult> {
  const draftId = createDraftRecordId(snapshot.clusterId, snapshot.noteId);

  try {
    await database.transaction("rw", database.drafts, async () => {
      const storedDraft: unknown = await database.drafts.get(draftId);
      const validation = validateStoredDraftRecord(storedDraft);
      if (isMatchingSavedDraft(validation, snapshot)) {
        await database.drafts.delete(draftId);
      }
    });
    return { status: "ok" };
  } catch (error) {
    return unavailableDraftWriteResult(classifyPersistenceError(error));
  }
}

function isMatchingSavedDraft(
  validation: ReturnType<typeof validateStoredDraftRecord>,
  snapshot: SavedDraftSnapshot,
): boolean {
  if (validation.status !== "valid") {
    return false;
  }
  return matchesSavedSnapshot(validation.record, snapshot);
}

function matchesSavedSnapshot(
  draft: DraftRecord,
  snapshot: SavedDraftSnapshot,
): boolean {
  if (draft.baseContentHash !== snapshot.baseContentHash) {
    return false;
  }
  return (
    normalizeMarkdown(draft.markdown) === normalizeMarkdown(snapshot.markdown)
  );
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n");
}

async function readDraft(
  database: AzuriteBrowserDatabase,
  clusterId: string,
  noteId: string,
): Promise<DraftReadResult> {
  const draftId = createDraftRecordId(clusterId, noteId);

  try {
    const storedDraft = await database.drafts.get(draftId);

    if (storedDraft === undefined) {
      return { draft: undefined, status: "ok" };
    }

    return await handleStoredDraft(database, draftId, storedDraft);
  } catch (error) {
    return unavailableDraftReadResult(classifyPersistenceError(error));
  }
}

async function handleStoredDraft(
  database: AzuriteBrowserDatabase,
  draftId: string,
  storedDraft: unknown,
): Promise<DraftReadResult> {
  const validation = validateStoredDraftRecord(storedDraft);

  if (validation.status === "valid") {
    return { draft: validation.record, status: "ok" };
  }

  if (validation.status === "preserve") {
    return { draft: undefined, status: "ok" };
  }

  await database.drafts.delete(draftId);
  return unavailableDraftReadResult("validation_failed");
}

async function writeDraft(
  database: AzuriteBrowserDatabase,
  draft: DraftRecord,
): Promise<DraftWriteResult> {
  try {
    await database.drafts.put(draft);
    return { status: "ok" };
  } catch (error) {
    return unavailableDraftWriteResult(classifyPersistenceError(error));
  }
}

async function deleteDraft(
  database: AzuriteBrowserDatabase,
  clusterId: string,
  noteId: string,
): Promise<DraftWriteResult> {
  try {
    await database.drafts.delete(createDraftRecordId(clusterId, noteId));
    return { status: "ok" };
  } catch (error) {
    return unavailableDraftWriteResult(classifyPersistenceError(error));
  }
}

function unavailableDraftReadResult(
  reason: DraftPersistenceUnavailableReason,
): DraftReadResult {
  return { reason, status: "unavailable" };
}

function unavailableDraftWriteResult(
  reason: DraftPersistenceUnavailableReason,
): DraftWriteResult {
  return { reason, status: "unavailable" };
}

const persistenceErrorReasons = new Map<
  string,
  DraftPersistenceUnavailableReason
>([
  ["BlockedError", "blocked_upgrade"],
  ["DatabaseClosedError", "database_unavailable"],
  ["InvalidStateError", "database_unavailable"],
  ["MissingAPIError", "database_unavailable"],
  ["OpenFailedError", "database_unavailable"],
  ["QuotaExceededError", "quota_exceeded"],
  ["UnknownError", "database_unavailable"],
  ["UpgradeError", "blocked_upgrade"],
  ["VersionError", "blocked_upgrade"],
]);

function classifyPersistenceError(
  error: unknown,
): DraftPersistenceUnavailableReason {
  const mappedReason = getMappedErrorReason(error);

  if (mappedReason !== undefined) {
    return mappedReason;
  }

  return error instanceof Error ? "write_failed" : "database_unavailable";
}

function getMappedErrorReason(
  error: unknown,
): DraftPersistenceUnavailableReason | undefined {
  return error instanceof Error
    ? persistenceErrorReasons.get(error.name)
    : undefined;
}
