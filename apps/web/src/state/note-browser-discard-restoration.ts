import { createDraftPersistenceIssue } from "../persistence/draft-issues.js";
import type { DraftFailureDetail } from "../persistence/draft-workflow-types.js";
import type { StoreContext } from "./note-browser-contracts.js";
import type { EditorSession, NoteViewState } from "./note-browser-types.js";

type MissingDraftState = Extract<
  NoteViewState,
  { readonly status: "missing-draft" }
>;

/** Exact compatible surface whose current admission epoch is being discarded. */
export type DiscardTarget =
  | {
      readonly closedEpoch: number;
      readonly disposition: "conflict" | "recovered";
      readonly editor: EditorSession;
      readonly kind: "editor";
      readonly noteId: string;
      readonly ownerKey: string;
    }
  | {
      readonly closedEpoch: number;
      readonly disposition: "recovered";
      readonly kind: "missing";
      readonly noteId: string;
      readonly noteState: MissingDraftState;
      readonly ownerKey: string;
    };

/** Restores the exact surface under a fresh epoch when a future record appears. */
export function restoreProtectedDiscard(input: {
  readonly context: StoreContext;
  readonly schemaVersion: number;
  readonly target: DiscardTarget;
}): void {
  const restoredEpoch = input.target.closedEpoch + 1;
  input.context.set((state) => {
    const noteState = getProtectedNoteState(
      state.noteState,
      input.target,
      restoredEpoch,
      input.schemaVersion,
    );
    return noteState === undefined ? state : { noteState };
  });
}

/** Restores the exact surface under a fresh epoch after Discard failure. */
export function restoreFailedDiscard(input: {
  readonly clusterId: string | undefined;
  readonly context: StoreContext;
  readonly failure: DraftFailureDetail;
  readonly target: DiscardTarget;
}): void {
  const restoredEpoch = input.target.closedEpoch + 1;
  const issue = createDraftPersistenceIssue({
    clusterId: input.clusterId,
    draftEpoch: restoredEpoch,
    failure: input.failure,
    noteId: input.target.noteId,
    operation: "discard",
    ownerKey: input.target.ownerKey,
    retryAction: "retry_discard",
  });
  input.context.set((state) => {
    const noteState = getFailedNoteState(
      state.noteState,
      input.target,
      restoredEpoch,
      issue,
    );
    return noteState === undefined ? state : { noteState };
  });
}

/** Reports whether the exact surface still owns the Discard result. */
export function ownsDiscardTarget(
  target: DiscardTarget,
  context: StoreContext,
): boolean {
  return target.kind === "editor"
    ? ownsEditorTarget(context.get().noteState, target)
    : ownsMissingTarget(context.get().noteState, target);
}

function getProtectedNoteState(
  state: NoteViewState,
  target: DiscardTarget,
  restoredEpoch: number,
  schemaVersion: number,
): NoteViewState | undefined {
  if (target.kind === "editor") {
    return ownsEditorTarget(state, target)
      ? {
          editor: {
            ...state.editor,
            draftDisposition: "preserved_unknown",
            draftEpoch: restoredEpoch,
            persistenceIssue: undefined,
            preservedSchemaVersion: schemaVersion,
          },
          status: "ready",
        }
      : undefined;
  }
  return ownsMissingTarget(state, target)
    ? {
        ...state,
        draftDisposition: "preserved_unknown",
        draftEpoch: restoredEpoch,
        persistenceIssue: undefined,
        preservedSchemaVersion: schemaVersion,
      }
    : undefined;
}

function getFailedNoteState(
  state: NoteViewState,
  target: DiscardTarget,
  restoredEpoch: number,
  issue: ReturnType<typeof createDraftPersistenceIssue>,
): NoteViewState | undefined {
  if (target.kind === "editor") {
    return ownsEditorTarget(state, target)
      ? {
          editor: {
            ...state.editor,
            draftEpoch: restoredEpoch,
            persistenceIssue: issue,
          },
          status: "ready",
        }
      : undefined;
  }
  return ownsMissingTarget(state, target)
    ? { ...state, draftEpoch: restoredEpoch, persistenceIssue: issue }
    : undefined;
}

function ownsEditorTarget(
  state: NoteViewState,
  target: { readonly closedEpoch: number; readonly ownerKey: string },
): state is Extract<NoteViewState, { readonly status: "ready" }> {
  return (
    state.status === "ready" &&
    state.editor.sessionKey === target.ownerKey &&
    state.editor.draftEpoch === target.closedEpoch
  );
}

function ownsMissingTarget(
  state: NoteViewState,
  target: { readonly closedEpoch: number; readonly ownerKey: string },
): state is MissingDraftState {
  return (
    state.status === "missing-draft" &&
    state.renderedOwnerKey === target.ownerKey &&
    state.draftEpoch === target.closedEpoch
  );
}
