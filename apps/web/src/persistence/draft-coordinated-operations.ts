import type { KeyedTaskCoordinator } from "@azurite/shared";

import type {
  DraftPersistence,
  DraftReadResult,
  DraftRecordMutationResult,
} from "./draft-database.js";

/** Ordered read result that keeps a queue rejection distinct from Dexie. */
export type CoordinatedDraftReadResult =
  | DraftReadResult
  | {
      readonly clusterId: string;
      readonly noteId: string;
      readonly reason: "queue_task_failed";
      readonly status: "queue_failed";
    };

/** Ordered mutation result that keeps a queue rejection distinct from Dexie. */
export type CoordinatedDraftMutationResult =
  | DraftRecordMutationResult
  | { readonly reason: "queue_task_failed"; readonly status: "queue_failed" };

/** Runs an exact read while converting infrastructure rejection to product truth. */
export async function runCoordinatedDraftRead(
  tasks: KeyedTaskCoordinator,
  key: string,
  clusterId: string,
  noteId: string,
  persistence: DraftPersistence,
): Promise<CoordinatedDraftReadResult> {
  try {
    return await tasks.run(
      key,
      async () => await persistence.readDraft(clusterId, noteId),
    );
  } catch {
    return {
      clusterId,
      noteId,
      reason: "queue_task_failed",
      status: "queue_failed",
    };
  }
}

/** Runs one exact mutation while releasing a rejected keyed tail. */
export async function runCoordinatedDraftMutation(
  tasks: KeyedTaskCoordinator,
  key: string,
  mutation: () => Promise<DraftRecordMutationResult>,
): Promise<CoordinatedDraftMutationResult> {
  try {
    return await tasks.run(key, mutation);
  } catch {
    return { reason: "queue_task_failed", status: "queue_failed" };
  }
}
