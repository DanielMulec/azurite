import type { CoordinatedDraftMutationResult } from "../persistence/draft-persistence-coordinator.js";
import type {
  DiscardResult,
  DraftFailureDetail,
} from "../persistence/draft-workflow-types.js";
import type { StoreContext } from "./note-browser-contracts.js";
import {
  createDiscardIssue,
  createFailedDiscardResult,
  createPreservedDiscardResult,
  createSupersededDiscardResult,
} from "./note-browser-discard-results.js";
import { StateApplicationTracker } from "./note-browser-state-application.js";
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

type DiscardRestorationInput = {
  readonly clusterId: string | undefined;
  readonly context: StoreContext;
  readonly target: DiscardTarget;
};

type PreservedRestorationInput = DiscardRestorationInput & {
  readonly restoredEpoch: number;
  readonly schemaVersion: number;
};

type FailedRestorationInput = DiscardRestorationInput & {
  readonly failure: DraftFailureDetail;
  readonly restoredEpoch: number;
};

/** Restores the exact surface under a fresh epoch when a future record appears. */
export function restorePreservedDiscard(
  input: DiscardRestorationInput & {
    readonly clusterId: string;
    readonly mutation: Extract<
      CoordinatedDraftMutationResult,
      { readonly status: "preserved_unknown" }
    >;
  },
): DiscardResult {
  const restoration: PreservedRestorationInput = {
    ...input,
    restoredEpoch: input.target.closedEpoch + 1,
    schemaVersion: input.mutation.schemaVersion,
  };
  const tracker = applyPreservedRestoration(restoration);
  if (!tracker.didApply()) {
    return createTargetSupersededResult(input.target, input.clusterId);
  }
  return createPreservedDiscardResult({
    closedEpoch: input.target.closedEpoch,
    clusterId: input.clusterId,
    noteId: input.target.noteId,
    ownerKey: input.target.ownerKey,
    restoredEpoch: restoration.restoredEpoch,
    schemaVersion: restoration.schemaVersion,
  });
}

/** Restores the exact surface under a fresh epoch after Discard failure. */
export function restoreFailedDiscard(
  input: DiscardRestorationInput & {
    readonly failure: DraftFailureDetail;
  },
): DiscardResult {
  const restoration: FailedRestorationInput = {
    ...input,
    restoredEpoch: input.target.closedEpoch + 1,
  };
  const issue = createDiscardIssue(
    {
      clusterId: input.clusterId,
      noteId: input.target.noteId,
      ownerKey: input.target.ownerKey,
      restoredEpoch: restoration.restoredEpoch,
    },
    input.failure,
  );
  const tracker = applyFailedRestoration(restoration, issue);
  if (!tracker.didApply()) {
    return createTargetSupersededResult(input.target, input.clusterId);
  }
  return createFailedDiscardResult(
    {
      closedEpoch: input.target.closedEpoch,
      clusterId: input.clusterId,
      disposition: input.target.disposition,
      noteId: input.target.noteId,
      ownerKey: input.target.ownerKey,
      restoredEpoch: restoration.restoredEpoch,
    },
    input.failure,
    issue,
  );
}

/** Builds the owner-lost result shared by completion and restoration paths. */
export function createTargetSupersededResult(
  target: DiscardTarget,
  clusterId: string | undefined,
): Extract<DiscardResult, { readonly status: "superseded" }> {
  return createSupersededDiscardResult({
    closedEpoch: target.closedEpoch,
    clusterId,
    noteId: target.noteId,
    ownerKey: target.ownerKey,
  });
}

/** Reports whether the exact surface still owns the Discard result. */
export function ownsDiscardTarget(
  target: DiscardTarget,
  context: StoreContext,
): boolean {
  const noteState = context.get().noteState;
  return target.kind === "editor"
    ? ownsEditorTarget(noteState, target)
    : ownsMissingTarget(noteState, target);
}

function applyPreservedRestoration(
  input: PreservedRestorationInput,
): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  input.context.set((state) => {
    const noteState = getPreservedNoteState(state.noteState, input);
    if (noteState === undefined) {
      return state;
    }
    tracker.markApplied();
    return { noteState };
  });
  return tracker;
}

function getPreservedNoteState(
  state: NoteViewState,
  input: PreservedRestorationInput,
): NoteViewState | undefined {
  return input.target.kind === "editor"
    ? getPreservedEditorState(state, input)
    : getPreservedMissingState(state, input);
}

function getPreservedEditorState(
  state: NoteViewState,
  input: PreservedRestorationInput,
): NoteViewState | undefined {
  if (!ownsEditorTarget(state, input.target)) {
    return undefined;
  }
  return {
    editor: {
      ...state.editor,
      draftDisposition: "preserved_unknown",
      draftEpoch: input.restoredEpoch,
      persistenceIssue: undefined,
      preservedSchemaVersion: input.schemaVersion,
    },
    status: "ready",
  };
}

function getPreservedMissingState(
  state: NoteViewState,
  input: PreservedRestorationInput,
): NoteViewState | undefined {
  if (!ownsMissingTarget(state, input.target)) {
    return undefined;
  }
  return {
    ...state,
    draftDisposition: "preserved_unknown",
    draftEpoch: input.restoredEpoch,
    persistenceIssue: undefined,
    preservedSchemaVersion: input.schemaVersion,
  };
}

function applyFailedRestoration(
  input: FailedRestorationInput,
  issue: ReturnType<typeof createDiscardIssue>,
): StateApplicationTracker {
  const tracker = new StateApplicationTracker();
  input.context.set((state) => {
    const noteState = getFailedNoteState(state.noteState, input, issue);
    if (noteState === undefined) {
      return state;
    }
    tracker.markApplied();
    return { noteState };
  });
  return tracker;
}

function getFailedNoteState(
  state: NoteViewState,
  input: FailedRestorationInput,
  issue: ReturnType<typeof createDiscardIssue>,
): NoteViewState | undefined {
  return input.target.kind === "editor"
    ? getFailedEditorState(state, input, issue)
    : getFailedMissingState(state, input, issue);
}

function getFailedEditorState(
  state: NoteViewState,
  input: FailedRestorationInput,
  issue: ReturnType<typeof createDiscardIssue>,
): NoteViewState | undefined {
  if (!ownsEditorTarget(state, input.target)) {
    return undefined;
  }
  return {
    editor: {
      ...state.editor,
      draftEpoch: input.restoredEpoch,
      persistenceIssue: issue,
    },
    status: "ready",
  };
}

function getFailedMissingState(
  state: NoteViewState,
  input: FailedRestorationInput,
  issue: ReturnType<typeof createDiscardIssue>,
): NoteViewState | undefined {
  if (!ownsMissingTarget(state, input.target)) {
    return undefined;
  }
  return {
    ...state,
    draftEpoch: input.restoredEpoch,
    persistenceIssue: issue,
  };
}

function ownsEditorTarget(
  state: NoteViewState,
  target: { readonly ownerKey: string },
): state is Extract<NoteViewState, { readonly status: "ready" }> {
  return state.status === "ready" && state.editor.sessionKey === target.ownerKey;
}

function ownsMissingTarget(
  state: NoteViewState,
  target: { readonly ownerKey: string },
): state is MissingDraftState {
  return (
    state.status === "missing-draft" &&
    state.renderedOwnerKey === target.ownerKey
  );
}
