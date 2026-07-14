import type { NoteContentWithHash } from "@azurite/shared";

import { markdownEquals } from "../src/domain/markdown-equality.js";
import type { DraftPersistence } from "../src/persistence/draft-database.js";
import {
  createDraftRecord,
  createDraftRecordId,
  type DraftRecord,
} from "../src/persistence/draft-records.js";
import { createNoteBrowserStore } from "../src/state/note-browser-store.js";
import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import type { EditorSession } from "../src/state/note-browser-types.js";
import { createTestOccurrence } from "./note-browser-route-test-helpers.js";

export const readyClusterIdentity = {
  clusterId: "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793",
  status: "ready",
} as const;

export const unavailableClusterIdentity = {
  reason: "metadata_unwritable",
  status: "unavailable",
} as const;

type LoadedStoreOptions = {
  readonly api?: NoteBrowserApi;
  readonly draftPersistence?: DraftPersistence;
  readonly note?: NoteContentWithHash;
  readonly recovery?: "conflict" | "draft" | "none";
};

type SeededStoreOptions = {
  readonly api?: NoteBrowserApi;
  readonly draftPersistence?: DraftPersistence;
};

export function createLoadedStore(options: LoadedStoreOptions = {}) {
  const note = getLoadedNote(options);
  const recovery = getLoadedRecovery(options);
  const store = createSeededStore({
    api: getApiOption(options),
    draftPersistence: getDraftPersistenceOption(options),
  });

  const editor = createReadyEditor(note, recovery);
  const location = createTestOccurrence(note.id, 0);
  store.setState({
    committedRouteView: {
      location,
      noteId: note.id,
      renderedOwnerKey: editor.sessionKey,
      view: "ready",
    },
    noteState: {
      editor,
      status: "ready",
    },
    selectedNoteId: note.id,
  });

  return store;
}

export function createSeededStore(options: SeededStoreOptions = {}) {
  const home = createNote("index.md", "# Home", "sha256-home");
  const project = createNote(
    "Projects/azurite.md",
    "# Project",
    "sha256-project",
  );
  const store = createNoteBrowserStore({
    api: getApiOption(options),
    draftPersistence: getDraftPersistenceOption(options),
  });
  store.setState({
    clusterIdentity: readyClusterIdentity,
    notesState: {
      data: [toSummary(home), toSummary(project)],
      status: "ready",
    },
  });

  return store;
}

/** Publishes exact source input through the real store command boundary. */
export function publishSourceMarkdown(
  store: ReturnType<typeof createNoteBrowserStore>,
  markdown: string,
) {
  const state = store.getState();
  if (state.noteState.status !== "ready") {
    throw new Error("A ready editor is required to publish Markdown.");
  }
  return state.publishMarkdownChange({
    markdown,
    origin: "source_input",
    resolution: "exact_input",
    sessionKey: state.noteState.editor.sessionKey,
    trigger: "direct_input",
  });
}

export function createApi(patch: Partial<NoteBrowserApi> = {}): NoteBrowserApi {
  const home = createNote("index.md", "# Home", "sha256-home");
  const project = createNote(
    "Projects/azurite.md",
    "# Project",
    "sha256-project",
  );

  return {
    listNotes: () =>
      Promise.resolve({
        clusterIdentity: readyClusterIdentity,
        notes: [toSummary(home), toSummary(project)],
      }),
    readNote: (noteId) =>
      Promise.resolve({
        clusterIdentity: readyClusterIdentity,
        note: noteId === project.id ? project : home,
      }),
    saveNote: (input) =>
      Promise.resolve({
        clusterIdentity: readyClusterIdentity,
        note: createNote(input.noteId, input.markdown, "sha256-saved"),
      }),
    ...patch,
  };
}

export function createMemoryDraftPersistence(
  initialDrafts: readonly DraftRecord[] = [],
): {
  readonly persistence: DraftPersistence;
  readonly read: (
    draftClusterId: string,
    draftNoteId: string,
  ) => DraftRecord | undefined;
} {
  const drafts = new Map<string, DraftRecord>(
    initialDrafts.map((draft) => [draft.id, draft]),
  );

  return {
    persistence: {
      deleteDraft: (clusterId, noteId) => {
        const deleted = drafts.delete(createDraftRecordId(clusterId, noteId));
        return Promise.resolve({ status: deleted ? "deleted" : "absent" });
      },
      deleteDraftIfSavedSnapshotMatches: (snapshot) => {
        const draft = drafts.get(
          createDraftRecordId(snapshot.clusterId, snapshot.noteId),
        );
        if (draft === undefined) {
          return Promise.resolve({ status: "absent" });
        }
        if (draftMatchesSnapshot(draft, snapshot)) {
          drafts.delete(draft.id);
          return Promise.resolve({ status: "deleted" });
        }
        return Promise.resolve({ status: "not_matching" });
      },
      readDraft: (clusterId, noteId) => {
        const draft = drafts.get(createDraftRecordId(clusterId, noteId));
        return Promise.resolve(
          draft === undefined
            ? { clusterId, noteId, status: "absent" }
            : { draft, status: "found_current" },
        );
      },
      writeDraft: (draft) => {
        drafts.set(draft.id, draft);
        return Promise.resolve({ status: "written" });
      },
    },
    read: (draftClusterId, draftNoteId) =>
      drafts.get(createDraftRecordId(draftClusterId, draftNoteId)),
  };
}

function draftMatchesSnapshot(
  draft: DraftRecord | undefined,
  snapshot: Parameters<
    DraftPersistence["deleteDraftIfSavedSnapshotMatches"]
  >[0],
): draft is DraftRecord {
  if (
    draft === undefined ||
    draft.baseContentHash !== snapshot.baseContentHash
  ) {
    return false;
  }
  return markdownEquals(draft.markdown, snapshot.markdown);
}

export function createTestDraft(
  patch: Partial<Parameters<typeof createDraftRecord>[0]> = {},
): DraftRecord {
  return createDraftRecord({
    baseContentHash: "sha256-base",
    clusterId: readyClusterIdentity.clusterId,
    editorMode: "wysiwyg",
    markdown: "# Draft",
    noteId: "index.md",
    updatedAt: "2026-07-08T10:00:00.000Z",
    ...patch,
  });
}

export function createNote(
  id: string,
  markdown: string,
  contentHash: string,
): NoteContentWithHash {
  return {
    contentHash,
    fileName: id.split("/").at(-1) ?? id,
    id,
    lastModifiedAt: "2026-07-08T10:00:00.000Z",
    markdown,
    relativePath: id,
    sizeBytes: markdown.length,
    title: id === "index.md" ? "Home" : "Project Plan",
  };
}

export function toSummary(note: NoteContentWithHash) {
  return {
    fileName: note.fileName,
    id: note.id,
    lastModifiedAt: note.lastModifiedAt,
    relativePath: note.relativePath,
    sizeBytes: note.sizeBytes,
    title: note.title,
  };
}

export function createDeferred<T>(): {
  readonly promise: Promise<Awaited<T>>;
  readonly reject: (error: unknown) => void;
  readonly resolve: (value: Awaited<T>) => void;
} {
  let rejectDeferred: (error: unknown) => void = () => {};
  let resolveDeferred: (value: Awaited<T>) => void = () => {};
  const promise = new Promise<Awaited<T>>((resolve, reject) => {
    rejectDeferred = reject;
    resolveDeferred = resolve;
  });

  return { promise, reject: rejectDeferred, resolve: resolveDeferred };
}

function getLoadedNote(options: LoadedStoreOptions): NoteContentWithHash {
  return options.note ?? createNote("index.md", "# Home", "sha256-home");
}

function getLoadedRecovery(
  options: LoadedStoreOptions,
): "conflict" | "draft" | "none" {
  return options.recovery ?? "none";
}

function getApiOption(options: SeededStoreOptions): NoteBrowserApi {
  return options.api ?? createApi();
}

function getDraftPersistenceOption(
  options: SeededStoreOptions,
): DraftPersistence {
  return options.draftPersistence ?? createMemoryDraftPersistence().persistence;
}

function createReadyEditor(
  note: NoteContentWithHash,
  recovery: "conflict" | "draft" | "none",
): EditorSession {
  const draftDisposition = recovery === "draft" ? "recovered" : recovery;
  const recoveredSnapshotKey = getRecoveredSnapshotKey(draftDisposition);
  return {
    baseContentHash: getBaseContentHash(note, recovery),
    currentMarkdown: note.markdown,
    draftDisposition,
    draftEpoch: 0,
    durableSnapshotKey: recoveredSnapshotKey,
    editorMode: "wysiwyg",
    lastSnapshotKey: recoveredSnapshotKey,
    note,
    persistenceIssue: undefined,
    preservedSchemaVersion: undefined,
    revision: 0,
    savedMarkdown: getSavedMarkdown(note, recovery),
    saveStatus: getSaveStatus(recovery),
    sessionKey: "index.md:sha256-home:1",
  };
}

function getRecoveredSnapshotKey(
  disposition: EditorSession["draftDisposition"],
): string | undefined {
  return disposition === "none" ? undefined : "recovered-record";
}

function getBaseContentHash(
  note: NoteContentWithHash,
  recovery: "conflict" | "draft" | "none",
): string {
  return recovery === "none" ? note.contentHash : "sha256-old";
}

function getSavedMarkdown(
  note: NoteContentWithHash,
  recovery: "conflict" | "draft" | "none",
): string {
  return recovery === "none" ? note.markdown : "# Disk";
}

function getSaveStatus(
  recovery: "conflict" | "draft" | "none",
): EditorSession["saveStatus"] {
  return recovery === "conflict" ? "conflict" : "idle";
}

/** Returns one expected mock call with a useful failure for missing evidence. */
export function requireMockCall<Arguments extends readonly unknown[]>(
  calls: readonly Arguments[],
  index: number,
): Arguments {
  const call = calls[index];
  if (call === undefined) {
    throw new Error(`Expected mock call ${String(index + 1)} to exist.`);
  }
  return call;
}
