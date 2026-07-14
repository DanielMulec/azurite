import type { DraftCleanupRetryRegistry } from "../persistence/draft-cleanup-retry-registry.js";
import type { DraftPersistenceCoordinator } from "../persistence/draft-persistence-coordinator.js";
import type { NoteBrowserStateAccess } from "./note-browser-contracts.js";

/** Dependencies shared only by editor and browser-draft workflows. */
export type DraftWorkflowAccess = {
  readonly cleanupRetries: DraftCleanupRetryRegistry;
  readonly coordinator: DraftPersistenceCoordinator;
  readonly state: NoteBrowserStateAccess;
};

/** Allocates one workflow-private immutable draft snapshot identity. */
export type SnapshotKeyAllocator = (
  sessionKey: string,
  revision: number,
) => string;

/** Creates a deterministic snapshot allocator owned by one workflow. */
export function createSnapshotKeyAllocator(): SnapshotKeyAllocator {
  let version = 0;
  return (sessionKey, revision) => {
    version += 1;
    return `${sessionKey}:revision:${String(revision)}:snapshot:${String(version)}`;
  };
}
