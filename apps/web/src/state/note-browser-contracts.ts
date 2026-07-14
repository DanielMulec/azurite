import type {
  ApiRequestMetadata,
  ListNotesResponse,
  ReadNoteResponse,
  SaveNoteInput,
  SaveNoteResponse,
} from "@azurite/shared";
import type { StoreApi } from "zustand/vanilla";

import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { DraftPersistenceCoordinator } from "../persistence/draft-persistence-coordinator.js";
import type { DraftCleanupRetryRegistry } from "../persistence/draft-cleanup-retry-registry.js";
import type { DraftPersistence } from "../persistence/draft-database.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type {
  DurabilityCause,
  HandoffDecision,
} from "../persistence/draft-workflow-types.js";
import type { NoteLoadAuthorization } from "../routing/route-transition-types.js";
import type {
  RouteStoreApplyInput,
  RouteStoreApplyResult,
  RouteStoreExecutor,
  RouteNotesResult,
} from "../routing/route-store-executor.js";
import type { EditorSession } from "./note-browser-types.js";
import type { NoteBrowserSnapshot } from "./note-browser-types.js";

/** Ephemeral ownership for one in-flight note load. */
export type ActiveNoteLoad = {
  readonly authorization: NoteLoadAuthorization;
  readonly metadata: ApiRequestMetadata;
  readonly noteId: string;
  readonly promise: Promise<RouteStoreApplyResult>;
  readonly requestSequence: number;
  readonly routeSource: string;
};

/** Ephemeral ownership for the one coalesced notes-list request. */
export type ActiveNotesLoad = {
  readonly promise: Promise<RouteNotesResult>;
  readonly requestSequence: number;
};

/** Ephemeral ownership for one in-flight manual save. */
export type ActiveNoteSave = {
  readonly editor: EditorSession;
  readonly metadata: ApiRequestMetadata;
  readonly promise: Promise<void>;
};

/** Server API boundary used by the note browser store actions. */
export type NoteBrowserApi = {
  readonly listNotes: (
    metadata: ApiRequestMetadata,
  ) => Promise<ListNotesResponse>;
  readonly readNote: (
    noteId: string,
    metadata: ApiRequestMetadata,
  ) => Promise<ReadNoteResponse>;
  readonly saveNote: (
    input: SaveNoteInput,
    metadata: ApiRequestMetadata,
  ) => Promise<SaveNoteResponse>;
};

/** Zustand store shape for note navigation, editing, saving, and recovery. */
export type NoteBrowserStore = NoteBrowserSnapshot & {
  readonly activateRouteIntent: RouteStoreExecutor["activateRouteIntent"];
  readonly applyRoute: (
    input: RouteStoreApplyInput,
  ) => Promise<RouteStoreApplyResult>;
  readonly discardDraftAndReloadDiskVersion: () => Promise<void>;
  readonly discardMissingDraft: () => Promise<void>;
  readonly flushPendingDraft: (
    cause?: DurabilityCause,
  ) => Promise<HandoffDecision>;
  readonly ensureNotes: () => Promise<RouteNotesResult>;
  readonly getCoherentView: RouteStoreExecutor["getCoherentView"];
  readonly getRenderedOwnerKey: RouteStoreExecutor["getRenderedOwnerKey"];
  readonly publishMarkdownChange: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly retryDraftPersistenceIssue: () => Promise<void>;
  readonly saveSelectedNote: () => Promise<void>;
  readonly reportHistoryUnavailable: RouteStoreExecutor["reportHistoryUnavailable"];
  readonly updateEditorMode: (editorMode: EditorMode) => void;
};

/** Mutable action context shared by focused store action modules. */
export type StoreContext = {
  readonly api: NoteBrowserApi;
  readonly beginRouteApplication: () => void;
  readonly commitRouteApplication: () => void;
  readonly draftPersistence: DraftPersistence;
  readonly draftCoordinator: DraftPersistenceCoordinator;
  readonly draftCleanupRetries: DraftCleanupRetryRegistry;
  readonly clearActiveNoteLoad: (
    promise: Promise<RouteStoreApplyResult>,
  ) => void;
  readonly clearActiveNotesLoad: (promise: Promise<RouteNotesResult>) => void;
  readonly clearActiveNoteSave: (
    noteId: string,
    promise: Promise<void>,
  ) => void;
  readonly get: () => NoteBrowserStore;
  readonly getActiveNoteLoad: () => ActiveNoteLoad | undefined;
  readonly getActiveNotesLoad: () => ActiveNotesLoad | undefined;
  readonly getActiveNoteSave: (noteId: string) => ActiveNoteSave | undefined;
  readonly getCurrentRouteIntentKey: () => string | undefined;
  readonly isCurrentNoteRequest: (
    authorization: NoteLoadAuthorization,
    requestSequence: number,
    noteId: string,
  ) => boolean;
  readonly isCurrentNotesRequest: (requestSequence: number) => boolean;
  readonly nextEditorSessionKey: (
    noteId: string,
    contentHash: string,
  ) => string;
  readonly nextSnapshotKey: (sessionKey: string, revision: number) => string;
  readonly nextNoteRequestSequence: () => number;
  readonly nextNotesRequestSequence: () => number;
  readonly restoreRoutePredecessor: () => void;
  readonly set: StoreApi<NoteBrowserStore>["setState"];
  readonly setActiveNoteLoad: (load: ActiveNoteLoad) => void;
  readonly setActiveNotesLoad: (load: ActiveNotesLoad) => void;
  readonly setActiveNoteSave: (noteId: string, save: ActiveNoteSave) => void;
  readonly setCurrentRouteIntent: (intentKey: string) => void;
};
