import type { StoreApi } from "zustand/vanilla";

import type { DurabilityResult } from "../persistence/draft-workflow-types.js";
import type {
  RouteGateResult,
  RouteGateSettlement,
} from "../routing/route-transition-types.js";
import type { NoteBrowserStore } from "../state/note-browser-contracts.js";
import type { NoteViewState } from "../state/note-browser-types.js";
import type {
  EditorControllerCapability,
  EditorGatePreparationResult,
} from "./editor-session-gate-types.js";

type ReadyEditor = Extract<
  NoteViewState,
  { readonly status: "ready" }
>["editor"];

/** Maps the editor-owned result onto Slice 7C's target-free gate contract. */
export function mapEditorRouteResult(
  result: EditorGatePreparationResult,
): RouteGateResult {
  return result.status === "continue"
    ? { status: "continue" }
    : {
        reason: routeCancelReasonByEditorReason[result.reason],
        status: "cancel",
      };
}

/** Captures the focused outgoing control for restoration after cancellation. */
export function getFocusedElement(): HTMLElement | undefined {
  return typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined;
}

/** Restores focus only while the exact outgoing element remains connected. */
export function restoreFocus(element: HTMLElement | undefined): void {
  if (element?.isConnected === true) {
    element.focus();
  }
}

/** Returns whether Slice 7C retained the outgoing editor surface. */
export function retainedSurface(
  surfaceEffect: RouteGateSettlement["surfaceEffect"],
): boolean {
  return retainedSurfaceEffects.has(surfaceEffect);
}

/** Creates typed coordinator unavailability after an unexpected queue rejection. */
export function createUnavailableQueueDurability(
  controller: EditorControllerCapability,
  store: StoreApi<NoteBrowserStore>,
): Extract<DurabilityResult, { status: "unavailable" }> {
  const editor = getMatchingEditor(controller, store.getState().noteState);
  return editor === undefined
    ? createUnavailableWithoutEditor(controller)
    : createUnavailableForEditor(controller, editor);
}

function getMatchingEditor(
  controller: EditorControllerCapability,
  noteState: NoteViewState,
): ReadyEditor | undefined {
  if (noteState.status !== "ready") {
    return undefined;
  }
  return noteState.editor.sessionKey === controller.sessionKey
    ? noteState.editor
    : undefined;
}

function createUnavailableWithoutEditor(
  controller: EditorControllerCapability,
): Extract<DurabilityResult, { status: "unavailable" }> {
  return {
    cause: "route_transition",
    clusterId: undefined,
    disposition: "none",
    failure: { reason: "queue_task_failed", source: "coordinator" },
    noteId: "",
    revision: 0,
    sessionKey: controller.sessionKey,
    snapshotKey: undefined,
    status: "unavailable",
  };
}

function createUnavailableForEditor(
  controller: EditorControllerCapability,
  editor: ReadyEditor,
): Extract<DurabilityResult, { status: "unavailable" }> {
  return {
    cause: "route_transition",
    clusterId: getIssueClusterId(editor),
    disposition: editor.draftDisposition,
    failure: { reason: "queue_task_failed", source: "coordinator" },
    noteId: editor.note.id,
    revision: editor.revision,
    sessionKey: controller.sessionKey,
    snapshotKey: editor.lastSnapshotKey,
    status: "unavailable",
  };
}

function getIssueClusterId(editor: ReadyEditor): string | undefined {
  return editor.persistenceIssue === undefined
    ? undefined
    : editor.persistenceIssue.clusterId;
}

const routeCancelReasonByEditorReason = {
  commit_failed: "prerequisite_failed",
  durability_unavailable: "prerequisite_unavailable",
  owner_lost: "outgoing_owner_lost",
} as const;

const retainedSurfaceEffects = new Set<RouteGateSettlement["surfaceEffect"]>([
  "none",
  "retained",
]);
