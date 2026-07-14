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
import type { EditorMode } from "../persistence/draft-records.js";
import type {
  DurabilityCause,
  HandoffDecision,
} from "../persistence/draft-workflow-types.js";
import type { NoteBrowserSnapshot } from "./note-browser-types.js";

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
  readonly discardCurrentDraft: () => Promise<void>;
  readonly flushPendingDraft: (
    cause?: DurabilityCause,
  ) => Promise<HandoffDecision>;
  readonly publishMarkdownChange: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly retryDraftPersistenceIssue: () => Promise<void>;
  readonly saveSelectedNote: () => Promise<void>;
  readonly updateEditorMode: (editorMode: EditorMode) => void;
};

/** Exact Zustand access used by store-side workflows without exposing actions. */
export type NoteBrowserStateAccess = Pick<
  StoreApi<NoteBrowserStore>,
  "getState" | "setState"
>;
