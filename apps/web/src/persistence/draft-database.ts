import Dexie, { type Table } from "dexie";

import { markdownEquals } from "../domain/markdown-equality.js";
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
      readonly clusterId: string;
      readonly noteId: string;
      readonly status: "absent";
    }
  | {
      readonly clusterId: string;
      readonly noteId: string;
      readonly reason: "validation_failed";
      readonly status: "invalid_deleted";
    }
  | {
      readonly draft: DraftRecord;
      readonly status: "found_current";
    }
  | {
      readonly clusterId: string;
      readonly noteId: string;
      readonly schemaVersion: number;
      readonly status: "preserved_unknown";
    }
  | {
      readonly clusterId: string;
      readonly noteId: string;
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Result of writing one compatible durable browser draft. */
export type DraftWriteResult =
  | { readonly status: "written" }
  | { readonly schemaVersion: number; readonly status: "preserved_unknown" }
  | {
      readonly reason: DraftPersistenceUnavailableReason;
      readonly status: "unavailable";
    };

/** Exact transactional outcome of deleting one browser draft. */
export type DraftRecordMutationResult =
  | { readonly status: "deleted" }
  | { readonly status: "absent" }
  | { readonly reason: "validation_failed"; readonly status: "invalid_deleted" }
  | { readonly status: "not_matching" }
  | { readonly schemaVersion: number; readonly status: "preserved_unknown" }
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
  ) => Promise<DraftRecordMutationResult>;
  readonly deleteDraftIfSavedSnapshotMatches: (
    snapshot: SavedDraftSnapshot,
  ) => Promise<DraftRecordMutationResult>;
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
): Promise<DraftRecordMutationResult> {
  const draftId = createDraftRecordId(snapshot.clusterId, snapshot.noteId);

  try {
    return await database.transaction(
      "rw",
      database.drafts,
      async () => await deleteMatchingStoredDraft(database, draftId, snapshot),
    );
  } catch (error) {
    return unavailableDraftMutationResult(classifyPersistenceError(error));
  }
}

async function deleteMatchingStoredDraft(
  database: AzuriteBrowserDatabase,
  draftId: string,
  snapshot: SavedDraftSnapshot,
): Promise<DraftRecordMutationResult> {
  const storedDraft: unknown = await database.drafts.get(draftId);
  if (storedDraft === undefined) {
    return { status: "absent" };
  }
  return await deleteValidatedSavedDraft({
    database,
    draftId,
    snapshot,
    storedDraft,
  });
}

async function deleteValidatedSavedDraft(input: {
  readonly database: AzuriteBrowserDatabase;
  readonly draftId: string;
  readonly snapshot: SavedDraftSnapshot;
  readonly storedDraft: unknown;
}): Promise<DraftRecordMutationResult> {
  const validation = validateStoredDraftRecord(input.storedDraft);
  if (validation.status === "delete") {
    await input.database.drafts.delete(input.draftId);
    return { reason: "validation_failed", status: "invalid_deleted" };
  }
  if (validation.status === "preserve") {
    return {
      schemaVersion: validation.schemaVersion,
      status: "preserved_unknown",
    };
  }
  return await deleteCurrentSavedDraft(input, validation.record);
}

async function deleteCurrentSavedDraft(
  input: {
    readonly database: AzuriteBrowserDatabase;
    readonly draftId: string;
    readonly snapshot: SavedDraftSnapshot;
  },
  draft: DraftRecord,
): Promise<DraftRecordMutationResult> {
  if (!matchesSavedSnapshot(draft, input.snapshot)) {
    return { status: "not_matching" };
  }
  await input.database.drafts.delete(input.draftId);
  return { status: "deleted" };
}

function matchesSavedSnapshot(
  draft: DraftRecord,
  snapshot: SavedDraftSnapshot,
): boolean {
  if (draft.baseContentHash !== snapshot.baseContentHash) {
    return false;
  }
  return markdownEquals(draft.markdown, snapshot.markdown);
}

async function readDraft(
  database: AzuriteBrowserDatabase,
  clusterId: string,
  noteId: string,
): Promise<DraftReadResult> {
  const draftId = createDraftRecordId(clusterId, noteId);

  try {
    return await database.transaction("rw", database.drafts, async () => {
      const storedDraft: unknown = await database.drafts.get(draftId);

      if (storedDraft === undefined) {
        return { clusterId, noteId, status: "absent" };
      }

      return await handleStoredDraft(
        { clusterId, database, draftId, noteId },
        storedDraft,
      );
    });
  } catch (error) {
    return unavailableDraftReadResult(
      clusterId,
      noteId,
      classifyPersistenceError(error),
    );
  }
}

async function handleStoredDraft(
  context: {
    readonly clusterId: string;
    readonly database: AzuriteBrowserDatabase;
    readonly draftId: string;
    readonly noteId: string;
  },
  storedDraft: unknown,
): Promise<DraftReadResult> {
  const validation = validateStoredDraftRecord(storedDraft);

  if (validation.status === "valid") {
    return { draft: validation.record, status: "found_current" };
  }

  if (validation.status === "preserve") {
    return {
      clusterId: context.clusterId,
      noteId: context.noteId,
      schemaVersion: validation.schemaVersion,
      status: "preserved_unknown",
    };
  }

  await context.database.drafts.delete(context.draftId);
  return {
    clusterId: context.clusterId,
    noteId: context.noteId,
    reason: "validation_failed",
    status: "invalid_deleted",
  };
}

async function writeDraft(
  database: AzuriteBrowserDatabase,
  draft: DraftRecord,
): Promise<DraftWriteResult> {
  try {
    return await database.transaction("rw", database.drafts, async () => {
      const storedDraft: unknown = await database.drafts.get(draft.id);
      const validation = validateStoredDraftRecord(storedDraft);
      if (validation.status === "preserve") {
        return {
          schemaVersion: validation.schemaVersion,
          status: "preserved_unknown",
        };
      }
      await database.drafts.put(draft);
      return { status: "written" };
    });
  } catch (error) {
    return unavailableDraftWriteResult(classifyPersistenceError(error));
  }
}

async function deleteDraft(
  database: AzuriteBrowserDatabase,
  clusterId: string,
  noteId: string,
): Promise<DraftRecordMutationResult> {
  const draftId = createDraftRecordId(clusterId, noteId);
  try {
    return await database.transaction(
      "rw",
      database.drafts,
      async () => await deleteStoredDraft(database, draftId),
    );
  } catch (error) {
    return unavailableDraftMutationResult(classifyPersistenceError(error));
  }
}

async function deleteStoredDraft(
  database: AzuriteBrowserDatabase,
  draftId: string,
): Promise<DraftRecordMutationResult> {
  const storedDraft: unknown = await database.drafts.get(draftId);
  if (storedDraft === undefined) {
    return { status: "absent" };
  }
  return await deleteValidatedDraft(database, draftId, storedDraft);
}

async function deleteValidatedDraft(
  database: AzuriteBrowserDatabase,
  draftId: string,
  storedDraft: unknown,
): Promise<DraftRecordMutationResult> {
  const validation = validateStoredDraftRecord(storedDraft);
  if (validation.status === "preserve") {
    return {
      schemaVersion: validation.schemaVersion,
      status: "preserved_unknown",
    };
  }
  await database.drafts.delete(draftId);
  return validation.status === "delete"
    ? { reason: "validation_failed", status: "invalid_deleted" }
    : { status: "deleted" };
}

function unavailableDraftReadResult(
  clusterId: string,
  noteId: string,
  reason: DraftPersistenceUnavailableReason,
): DraftReadResult {
  return { clusterId, noteId, reason, status: "unavailable" };
}

function unavailableDraftWriteResult(
  reason: DraftPersistenceUnavailableReason,
): DraftWriteResult {
  return { reason, status: "unavailable" };
}

function unavailableDraftMutationResult(
  reason: DraftPersistenceUnavailableReason,
): DraftRecordMutationResult {
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
