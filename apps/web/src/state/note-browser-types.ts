import type {
  ClusterIdentity,
  NoteContentWithHash,
  NoteSummary,
} from "@azurite/shared";

import type {
  DraftPersistenceUnavailableReason,
  DraftWriteResult,
} from "../persistence/draft-database.js";
import type { EditorMode } from "../persistence/draft-records.js";

/** Loadable note list state owned by the note browser store. */
export type LoadableNotes =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: readonly NoteSummary[] };

/** Render state for the selected-note editor surface. */
export type NoteViewState =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "missing"; readonly noteId: string }
  | {
      readonly draft: MissingNoteDraft;
      readonly noteId: string;
      readonly status: "missing-draft";
    }
  | { readonly editor: EditorSession; readonly status: "ready" };

/** Save lifecycle state for the current editor session. */
export type SaveStatus = "conflict" | "failed" | "idle" | "saving";

/** Recovery status for a draft restored from browser persistence. */
export type DraftRecoveryKind = "conflict" | "draft" | "none";

/** Store-owned editor session resolved before Milkdown mounts. */
export type EditorSession = {
  readonly baseContentHash: string;
  readonly currentMarkdown: string;
  readonly editorMode: EditorMode;
  readonly note: NoteContentWithHash;
  readonly recovery: DraftRecoveryKind;
  readonly revision: number;
  readonly savedMarkdown: string;
  readonly saveStatus: SaveStatus;
  readonly sessionKey: string;
};

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
  readonly draftRecoveryStatus: DraftRecoveryStatus;
  readonly noteState: NoteViewState;
  readonly notesState: LoadableNotes;
  readonly selectedNoteId: string | undefined;
};

/** Result returned by draft persistence mutations. */
export type DraftMutationResult = DraftWriteResult | undefined;
