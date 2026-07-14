import { vi } from "vitest";

import { createEditorSessionGate } from "../src/components/editor-session-gate.js";
import { MarkdownAuthorityController } from "../src/components/markdown-authority-controller.js";
import type {
  PublicationCommand,
  PublicationRejectionReason,
  PublicationResult,
} from "../src/domain/markdown-authority-types.js";
import type { EditorSession } from "../src/state/note-browser-types.js";
import { createLoadedStore } from "./note-browser-store-test-helpers.js";

type CompositionOptions = {
  readonly recovery?: "draft" | "none";
};

/** Composes the real authority controller, session gate, and Zustand store. */
export function createMarkdownAuthorityComposition(
  options: CompositionOptions = {},
) {
  const store =
    options.recovery === undefined
      ? createLoadedStore()
      : createLoadedStore({ recovery: options.recovery });
  const gate = createEditorSessionGate(store);
  let projection = getEditor(store).currentMarkdown;
  let rejectionReason: PublicationRejectionReason | undefined;
  const publish = vi.fn((command: PublicationCommand): PublicationResult => {
    return rejectionReason === undefined
      ? store.getState().publishMarkdownChange(command)
      : { reason: rejectionReason, status: "rejected" as const };
  });
  const controller = new MarkdownAuthorityController({
    isSessionFrozen: gate.isSessionFrozen,
    onModeChange: (mode) => {
      store.getState().updateEditorMode(mode);
    },
    publish,
    readProjection: () => projection,
    readSession: (sessionKey) => readSession(store, sessionKey),
    replaceProjection: (markdown) => {
      projection = markdown;
    },
    sessionKey: getEditor(store).sessionKey,
  });
  gate.registerController(controller);

  return {
    acceptPublications: () => {
      rejectionReason = undefined;
    },
    controller,
    gate,
    getEditor: () => getEditor(store),
    publish,
    rejectPublications: (reason: PublicationRejectionReason) => {
      rejectionReason = reason;
    },
    store,
  };
}

function readSession(
  store: ReturnType<typeof createLoadedStore>,
  sessionKey: string,
): EditorSession | undefined {
  const editor = getEditor(store);
  return editor.sessionKey === sessionKey ? editor : undefined;
}

function getEditor(store: ReturnType<typeof createLoadedStore>): EditorSession {
  const noteState = store.getState().noteState;
  if (noteState.status !== "ready") {
    throw new Error("Expected a ready editor-session composition.");
  }
  return noteState.editor;
}
