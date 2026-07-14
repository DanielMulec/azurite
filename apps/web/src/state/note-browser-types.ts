import type {
  ClusterIdentity,
  NoteContentWithHash,
  NoteSummary,
} from "@azurite/shared";

import type { DraftPersistenceUnavailableReason } from "../persistence/draft-database.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type {
  DraftDisposition,
  DraftPersistenceIssue,
} from "../persistence/draft-workflow-types.js";
import type {
  CommittedRouteView,
  RouteHistoryStatus,
} from "../routing/route-transition-types.js";

/** Loadable note list state owned by the note browser store. */
export type LoadableNotes =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: readonly NoteSummary[] };

/** Render state for the selected-note editor surface. */
export type NoteViewState =
  | {
      readonly status: "error";
      readonly message: string;
      readonly noteId: string;
    }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "missing"; readonly noteId: string }
  | {
      readonly draft: MissingNoteDraft;
      readonly draftDisposition: "preserved_unknown" | "recovered";
      readonly draftEpoch: number;
      readonly noteId: string;
      readonly persistenceIssue: DraftPersistenceIssue | undefined;
      readonly preservedSchemaVersion: number | undefined;
      readonly renderedOwnerKey: string;
      readonly status: "missing-draft";
    }
  | { readonly editor: EditorSession; readonly status: "ready" };

/** Save lifecycle state for the current editor session. */
export type SaveStatus = "conflict" | "failed" | "idle" | "saving";

/** Store-owned editor session resolved before Milkdown mounts. */
export type EditorSession = {
  readonly baseContentHash: string;
  readonly currentMarkdown: string;
  readonly draftDisposition: DraftDisposition;
  readonly draftEpoch: number;
  readonly durableSnapshotKey: string | undefined;
  readonly editorMode: EditorMode;
  readonly lastSnapshotKey: string | undefined;
  readonly note: NoteContentWithHash;
  readonly persistenceIssue: DraftPersistenceIssue | undefined;
  readonly preservedSchemaVersion: number | undefined;
  readonly revision: number;
  readonly savedMarkdown: string;
  readonly saveStatus: SaveStatus;
  readonly sessionKey: string;
};

/** Synchronous exact-key read of the current Zustand editor session. */
export type EditorSessionReader = (
  sessionKey: string,
) => EditorSession | undefined;

/** Recovered draft for a note that no longer exists on disk. */
export type MissingNoteDraft = {
  readonly editorMode: EditorMode;
  readonly markdown: string;
  readonly updatedAt: string;
};

/** Browser draft recovery availability shown to the user. */
export type DraftRecoveryStatus =
  | { readonly status: "available" }
  | {
      readonly message: string;
      readonly reason:
        "cluster_identity_unavailable" | DraftPersistenceUnavailableReason;
      readonly status: "degraded";
    };

/** Serializable snapshot of the note browser store state. */
export type NoteBrowserSnapshot = {
  readonly clusterIdentity: ClusterIdentity | undefined;
  readonly committedRouteView: CommittedRouteView | undefined;
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly noteState: NoteViewState;
  readonly notesState: LoadableNotes;
  readonly routeHistoryStatus: RouteHistoryStatus;
  readonly selectedNoteId: string | undefined;
};
