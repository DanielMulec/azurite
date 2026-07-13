import type { RefObject } from "react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";
import type { EditorSessionGate } from "./editor-session-gate.js";
import {
  createCrepeRuntime,
  type CrepeRuntime,
  type CrepeRuntimeFactory,
} from "./crepe-runtime.js";
import { MarkdownAuthorityController } from "./markdown-authority-controller.js";

export type MilkdownControllerInput = {
  readonly createRuntime?: CrepeRuntimeFactory;
  readonly initialDisposition: DraftDisposition;
  readonly initialMarkdown: string;
  readonly initialMode: EditorMode;
  readonly initialRevision: number;
  readonly onEditorModeChange: (editorMode: EditorMode) => void;
  readonly onPublishMarkdown: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly sessionGate: EditorSessionGate;
  readonly sessionKey: string;
};

export type MilkdownControllerView = {
  readonly editorError: string | undefined;
  readonly hasPublicationRetry: boolean;
  readonly isEditorReady: boolean;
  readonly isSourceMode: boolean;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly retryPublication: () => void;
  readonly showSourceMode: () => void;
  readonly showWysiwygMode: () => void;
  readonly sourceMarkdown: string;
  readonly updateSourceMarkdown: (markdown: string) => void;
};

/** Binds one pure authority controller to one Crepe instance and React view. */
export function useMilkdownEditorController(
  input: MilkdownControllerInput,
): MilkdownControllerView {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<CrepeRuntime | undefined>(undefined);
  const initialMarkdownRef = useRef(input.initialMarkdown);
  const runtimeFactoryRef = useRef(input.createRuntime ?? createCrepeRuntime);
  const callbacksRef = useRef({
    onEditorModeChange: input.onEditorModeChange,
    onPublishMarkdown: input.onPublishMarkdown,
  });
  callbacksRef.current = {
    onEditorModeChange: input.onEditorModeChange,
    onPublishMarkdown: input.onPublishMarkdown,
  };
  const [controller] = useState(
    () =>
      new MarkdownAuthorityController({
        initialDisposition: input.initialDisposition,
        initialMarkdown: input.initialMarkdown,
        initialMode: input.initialMode,
        initialRevision: input.initialRevision,
        onModeChange: (mode) => {
          callbacksRef.current.onEditorModeChange(mode);
        },
        publish: (command) => callbacksRef.current.onPublishMarkdown(command),
        readProjection: () => requireRuntime(runtimeRef.current).getMarkdown(),
        replaceProjection: (markdown) => {
          requireRuntime(runtimeRef.current).replaceMarkdown(markdown);
        },
        sessionKey: input.sessionKey,
      }),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useLayoutEffect(
    () => input.sessionGate.registerController(controller),
    [controller, input.sessionGate],
  );
  useCrepeLifecycle({
    controller,
    createRuntime: runtimeFactoryRef.current,
    initialMarkdown: initialMarkdownRef.current,
    rootRef,
    runtimeRef,
  });

  return {
    editorError: state.editorError,
    hasPublicationRetry: state.hasPublicationRetry,
    isEditorReady: state.lifecycle === "ready",
    isSourceMode: state.mode === "markdown",
    rootRef,
    retryPublication: () => {
      controller.retryPublication();
    },
    showSourceMode: () => {
      controller.showSource();
    },
    showWysiwygMode: () => {
      controller.showWysiwyg();
    },
    sourceMarkdown: state.sourceMarkdown,
    updateSourceMarkdown: (markdown) => {
      controller.publishSource(markdown);
    },
  };
}

function useCrepeLifecycle(input: {
  readonly controller: MarkdownAuthorityController;
  readonly createRuntime: CrepeRuntimeFactory;
  readonly initialMarkdown: string;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly runtimeRef: RefObject<CrepeRuntime | undefined>;
}): void {
  useEffect(() => {
    const root = input.rootRef.current;
    if (root === null) {
      input.controller.markFailed("The editor root was not available.");
      return;
    }
    let active = true;
    const runtime = input.createRuntime({
      initialMarkdown: input.initialMarkdown,
      onMarkdownUpdated: (markdown) => {
        if (active) {
          input.controller.publishWysiwyg(markdown);
        }
      },
      root,
    });
    input.runtimeRef.current = runtime;
    void runtime.create().then(
      () => {
        if (active) {
          input.controller.markReady();
        }
      },
      () => {
        if (active) {
          input.controller.markFailed(
            "The Milkdown editor could not be created.",
          );
        }
      },
    );
    return () => {
      active = false;
      input.runtimeRef.current = undefined;
      input.controller.destroy();
      void runtime.destroy().catch(noop);
    };
  }, [
    input.controller,
    input.createRuntime,
    input.initialMarkdown,
    input.rootRef,
    input.runtimeRef,
  ]);
}

function requireRuntime(runtime: CrepeRuntime | undefined): CrepeRuntime {
  if (runtime === undefined) {
    throw new Error("The Crepe runtime is not ready.");
  }
  return runtime;
}

function noop(): void {}
