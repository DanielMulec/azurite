import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
import type {
  DiscardResult,
  DraftFailureDetail,
} from "../persistence/draft-workflow-types.js";
import { getReadyClusterId } from "./note-browser-action-utils.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  createDiscardIssue,
  createFailedDiscardResult,
  createPreservedDiscardResult,
  createSupersededDiscardResult,
  getClusterIdentityDiscardFailure,
  getDiscardMutationFailure,
  isDiscardDeletionComplete,
} from "./note-browser-discard-results.js";
import { reloadSelectedNoteAction } from "./note-browser-route-actions.js";
import { applyMissingRoute } from "./note-browser-route-state.js";
import type { EditorSession, NoteViewState } from "./note-browser-types.js";

type MissingDraftState = Extract<
  NoteViewState,
  { readonly status: "missing-draft" }
>;

/** An inapplicable defensive call has no terminal Discard operation to report. */
export type DiscardActionResult = DiscardResult | undefined;

/** Closes a compatible recovery epoch before reloading exact disk authority. */
export async function discardDraftAndReloadDiskVersionAction(
  context: StoreContext,
): Promise<DiscardActionResult> {
  const noteState = context.get().noteState;
  if (noteState.status === "missing-draft") {
    return await discardMissingNoteDraftState(noteState, context);
  }
  if (
    noteState.status !== "ready" ||
    !isDiscardable(noteState.editor.draftDisposition)
  ) {
    return undefined;
  }
  return await discardEditorDraft(noteState.editor, context);
}

/** Closes a compatible missing-note recovery epoch before dismissing its view. */
export async function discardMissingDraftAction(
  context: StoreContext,
): Promise<DiscardActionResult> {
  const noteState = context.get().noteState;
  return noteState.status === "missing-draft" &&
    noteState.draftDisposition === "recovered"
    ? await discardMissingNoteDraftState(noteState, context)
    : undefined;
}

async function discardEditorDraft(
  editor: EditorSession,
  context: StoreContext,
): Promise<DiscardResult> {
  const closedEpoch = editor.draftEpoch;
  context.draftCoordinator.closeEpoch(editor.sessionKey, closedEpoch);
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    return restoreFailedEditorDiscard(
      editor,
      getClusterIdentityDiscardFailure(context),
      undefined,
      context,
    );
  }
  const mutation = await context.draftCoordinator.discard({
    clusterId,
    draftEpoch: closedEpoch,
    noteId: editor.note.id,
    ownerKey: editor.sessionKey,
  });
  if (isDiscardDeletionComplete(mutation)) {
    if (!ownsEditor(editor.sessionKey, context)) {
      return createEditorSupersededResult(editor, clusterId);
    }
    await reloadSelectedNoteAction(context);
    return {
      closedEpoch,
      clusterId,
      next: "reload_disk",
      noteId: editor.note.id,
      ownerKey: editor.sessionKey,
      status: "completed",
    };
  }
  if (mutation.status === "preserved_unknown") {
    return restorePreservedEditorDiscard(editor, clusterId, mutation, context);
  }
  return restoreFailedEditorDiscard(
    editor,
    getDiscardMutationFailure(mutation),
    clusterId,
    context,
  );
}

async function discardMissingNoteDraftState(
  noteState: MissingDraftState,
  context: StoreContext,
): Promise<DiscardResult> {
  const closedEpoch = noteState.draftEpoch;
  context.draftCoordinator.closeEpoch(noteState.renderedOwnerKey, closedEpoch);
  const clusterId = getReadyClusterId(context.get().clusterIdentity);
  if (clusterId === undefined) {
    return restoreFailedMissingDiscard(
      noteState,
      getClusterIdentityDiscardFailure(context),
      undefined,
      context,
    );
  }
  const mutation = await context.draftCoordinator.discard({
    clusterId,
    draftEpoch: closedEpoch,
    noteId: noteState.noteId,
    ownerKey: noteState.renderedOwnerKey,
  });
  if (isDiscardDeletionComplete(mutation)) {
    if (!ownsMissingDraft(noteState.renderedOwnerKey, context)) {
      return createMissingSupersededResult(noteState, clusterId);
    }
    applyMissingAfterDiscard(noteState.noteId, context);
    return {
      closedEpoch,
      clusterId,
      next: "missing_without_draft",
      noteId: noteState.noteId,
      ownerKey: noteState.renderedOwnerKey,
      status: "completed",
    };
  }
  if (mutation.status === "preserved_unknown") {
    return restorePreservedMissingDiscard(
      noteState,
      clusterId,
      mutation,
      context,
    );
  }
  return restoreFailedMissingDiscard(
    noteState,
    getDiscardMutationFailure(mutation),
    clusterId,
    context,
  );
}

function restorePreservedEditorDiscard(
  editor: EditorSession,
  clusterId: string,
  mutation: Extract<
    CoordinatedDraftMutationResult,
    { readonly status: "preserved_unknown" }
  >,
  context: StoreContext,
): DiscardResult {
  const restoredEpoch = editor.draftEpoch + 1;
  let didRestore = false;
  context.set((state) => {
    if (
      state.noteState.status !== "ready" ||
      state.noteState.editor.sessionKey !== editor.sessionKey
    ) {
      return state;
    }
    didRestore = true;
    return {
      noteState: {
        editor: {
          ...state.noteState.editor,
          draftDisposition: "preserved_unknown",
          draftEpoch: restoredEpoch,
          persistenceIssue: undefined,
          preservedSchemaVersion: mutation.schemaVersion,
        },
        status: "ready",
      },
    };
  });
  return didRestore
    ? createPreservedDiscardResult({
        closedEpoch: editor.draftEpoch,
        clusterId,
        noteId: editor.note.id,
        ownerKey: editor.sessionKey,
        restoredEpoch,
        schemaVersion: mutation.schemaVersion,
      })
    : createEditorSupersededResult(editor, clusterId);
}

function restorePreservedMissingDiscard(
  noteState: MissingDraftState,
  clusterId: string,
  mutation: Extract<
    CoordinatedDraftMutationResult,
    { readonly status: "preserved_unknown" }
  >,
  context: StoreContext,
): DiscardResult {
  const restoredEpoch = noteState.draftEpoch + 1;
  let didRestore = false;
  context.set((state) => {
    if (
      state.noteState.status !== "missing-draft" ||
      state.noteState.renderedOwnerKey !== noteState.renderedOwnerKey
    ) {
      return state;
    }
    didRestore = true;
    return {
      noteState: {
        ...state.noteState,
        draftDisposition: "preserved_unknown",
        draftEpoch: restoredEpoch,
        persistenceIssue: undefined,
        preservedSchemaVersion: mutation.schemaVersion,
      },
    };
  });
  return didRestore
    ? createPreservedDiscardResult({
        closedEpoch: noteState.draftEpoch,
        clusterId,
        noteId: noteState.noteId,
        ownerKey: noteState.renderedOwnerKey,
        restoredEpoch,
        schemaVersion: mutation.schemaVersion,
      })
    : createMissingSupersededResult(noteState, clusterId);
}

function restoreFailedEditorDiscard(
  editor: EditorSession,
  failure: DraftFailureDetail,
  clusterId: string | undefined,
  context: StoreContext,
): DiscardResult {
  const restoredEpoch = editor.draftEpoch + 1;
  const issue = createDiscardIssue(
    {
      clusterId,
      noteId: editor.note.id,
      ownerKey: editor.sessionKey,
      restoredEpoch,
    },
    failure,
  );
  let didRestore = false;
  context.set((state) => {
    if (
      state.noteState.status !== "ready" ||
      state.noteState.editor.sessionKey !== editor.sessionKey
    ) {
      return state;
    }
    didRestore = true;
    return {
      noteState: {
        editor: {
          ...state.noteState.editor,
          draftEpoch: restoredEpoch,
          persistenceIssue: issue,
        },
        status: "ready",
      },
    };
  });
  return didRestore
    ? createFailedDiscardResult(
        {
          closedEpoch: editor.draftEpoch,
          clusterId,
          disposition:
            editor.draftDisposition === "conflict" ? "conflict" : "recovered",
          noteId: editor.note.id,
          ownerKey: editor.sessionKey,
          restoredEpoch,
        },
        failure,
        issue,
      )
    : createEditorSupersededResult(editor, clusterId);
}

function restoreFailedMissingDiscard(
  noteState: MissingDraftState,
  failure: DraftFailureDetail,
  clusterId: string | undefined,
  context: StoreContext,
): DiscardResult {
  const restoredEpoch = noteState.draftEpoch + 1;
  const issue = createDiscardIssue(
    {
      clusterId,
      noteId: noteState.noteId,
      ownerKey: noteState.renderedOwnerKey,
      restoredEpoch,
    },
    failure,
  );
  let didRestore = false;
  context.set((state) => {
    if (
      state.noteState.status !== "missing-draft" ||
      state.noteState.renderedOwnerKey !== noteState.renderedOwnerKey
    ) {
      return state;
    }
    didRestore = true;
    return {
      noteState: {
        ...state.noteState,
        draftEpoch: restoredEpoch,
        persistenceIssue: issue,
      },
    };
  });
  return didRestore
    ? createFailedDiscardResult(
        {
          closedEpoch: noteState.draftEpoch,
          clusterId,
          disposition: "recovered",
          noteId: noteState.noteId,
          ownerKey: noteState.renderedOwnerKey,
          restoredEpoch,
        },
        failure,
        issue,
      )
    : createMissingSupersededResult(noteState, clusterId);
}

function isDiscardable(
  disposition: EditorSession["draftDisposition"],
): boolean {
  return disposition === "recovered" || disposition === "conflict";
}

function ownsEditor(sessionKey: string, context: StoreContext): boolean {
  const state = context.get().noteState;
  return state.status === "ready" && state.editor.sessionKey === sessionKey;
}

function ownsMissingDraft(ownerKey: string, context: StoreContext): boolean {
  const state = context.get().noteState;
  return (
    state.status === "missing-draft" && state.renderedOwnerKey === ownerKey
  );
}

function createEditorSupersededResult(
  editor: EditorSession,
  clusterId: string | undefined,
): Extract<DiscardResult, { readonly status: "superseded" }> {
  return createSupersededDiscardResult({
    closedEpoch: editor.draftEpoch,
    clusterId,
    noteId: editor.note.id,
    ownerKey: editor.sessionKey,
  });
}

function createMissingSupersededResult(
  state: MissingDraftState,
  clusterId: string | undefined,
): Extract<DiscardResult, { readonly status: "superseded" }> {
  return createSupersededDiscardResult({
    closedEpoch: state.draftEpoch,
    clusterId,
    noteId: state.noteId,
    ownerKey: state.renderedOwnerKey,
  });
}

function applyMissingAfterDiscard(noteId: string, context: StoreContext): void {
  const location = context.get().committedRouteView?.location;
  if (location === undefined) {
    context.set({ noteState: { noteId, status: "missing" } });
    return;
  }
  applyMissingRoute({ location, noteId }, context);
}
