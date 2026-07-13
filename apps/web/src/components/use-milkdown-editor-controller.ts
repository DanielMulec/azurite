import type { RefCallback } from "react";
import {
  useEffect,
  useLayoutEffect,
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
import type { MarkdownAuthorityState } from "./markdown-authority-controller-types.js";

/** Inputs that bind one React hook lifetime to one editor session. */
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

/** Render-safe view and commands exposed to the production editor component. */
export type MilkdownControllerView = {
  readonly editorError: string | undefined;
  readonly hasPublicationRetry: boolean;
  readonly isEditorReady: boolean;
  readonly isSourceMode: boolean;
  readonly rootRef: RefCallback<HTMLDivElement>;
  readonly retryPublication: () => void;
  readonly showSourceMode: () => void;
  readonly showWysiwygMode: () => void;
  readonly sourceMarkdown: string;
  readonly updateSourceMarkdown: (markdown: string) => void;
};

type ControllerResources = {
  readonly callbacks: EditorCallbackBridge;
  readonly controller: MarkdownAuthorityController;
  readonly createRuntime: CrepeRuntimeFactory;
  readonly initialMarkdown: string;
  readonly root: EditorRootOwner;
  readonly runtime: CrepeRuntimeOwner;
};

/** Binds one pure authority controller to one Crepe instance and React view. */
export function useMilkdownEditorController(
  input: MilkdownControllerInput,
): MilkdownControllerView {
  const [resources] = useState(() => createControllerResources(input));
  useLayoutEffect(() => {
    resources.callbacks.update({
      onEditorModeChange: input.onEditorModeChange,
      onPublishMarkdown: input.onPublishMarkdown,
    });
  }, [input.onEditorModeChange, input.onPublishMarkdown, resources.callbacks]);
  const state = useSyncExternalStore(
    resources.controller.subscribe,
    resources.controller.getSnapshot,
    resources.controller.getSnapshot,
  );
  useLayoutEffect(
    () => input.sessionGate.registerController(resources.controller),
    [input.sessionGate, resources.controller],
  );
  useCrepeLifecycle(resources);
  return createControllerView(resources, state);
}

function createControllerResources(
  input: MilkdownControllerInput,
): ControllerResources {
  const callbacks = new EditorCallbackBridge(input);
  const runtime = new CrepeRuntimeOwner();
  const controller = new MarkdownAuthorityController({
    initialDisposition: input.initialDisposition,
    initialMarkdown: input.initialMarkdown,
    initialMode: input.initialMode,
    initialRevision: input.initialRevision,
    onModeChange: callbacks.onModeChange,
    publish: callbacks.publish,
    readProjection: () => runtime.require().getMarkdown(),
    replaceProjection: (markdown) => {
      runtime.require().replaceMarkdown(markdown);
    },
    sessionKey: input.sessionKey,
  });
  return {
    callbacks,
    controller,
    createRuntime: input.createRuntime ?? createCrepeRuntime,
    initialMarkdown: input.initialMarkdown,
    root: new EditorRootOwner(),
    runtime,
  };
}

function createControllerView(
  resources: ControllerResources,
  state: MarkdownAuthorityState,
): MilkdownControllerView {
  return {
    editorError: state.editorError,
    hasPublicationRetry: state.hasPublicationRetry,
    isEditorReady: state.lifecycle === "ready",
    isSourceMode: state.mode === "markdown",
    rootRef: resources.root.set,
    retryPublication: () => {
      resources.controller.retryPublication();
    },
    showSourceMode: () => {
      resources.controller.showSource();
    },
    showWysiwygMode: () => {
      resources.controller.showWysiwyg();
    },
    sourceMarkdown: state.sourceMarkdown,
    updateSourceMarkdown: (markdown) => {
      resources.controller.publishSource(markdown);
    },
  };
}

function useCrepeLifecycle(input: ControllerResources): void {
  const { controller, createRuntime, initialMarkdown, root, runtime } = input;
  useEffect(() => {
    const rootElement = root.get();
    if (rootElement === null) {
      controller.markFailed("The editor root was not available.");
      return;
    }
    let active = true;
    const instance = createRuntime({
      initialMarkdown,
      onMarkdownUpdated: (markdown) => {
        if (active) {
          controller.publishWysiwyg(markdown);
        }
      },
      root: rootElement,
    });
    runtime.set(instance);
    void instance.create().then(
      () => {
        if (active) {
          controller.markReady();
        }
      },
      () => {
        if (active) {
          controller.markFailed("The Milkdown editor could not be created.");
        }
      },
    );
    return () => {
      active = false;
      runtime.clear(instance);
      controller.destroy();
      void instance.destroy().catch(() => {});
    };
  }, [controller, createRuntime, initialMarkdown, root, runtime]);
}

type EditorCallbacks = Pick<
  MilkdownControllerInput,
  "onEditorModeChange" | "onPublishMarkdown"
>;

class EditorCallbackBridge {
  #callbacks: EditorCallbacks;

  constructor(callbacks: EditorCallbacks) {
    this.#callbacks = callbacks;
  }

  update(callbacks: EditorCallbacks): void {
    this.#callbacks = callbacks;
  }

  onModeChange = (mode: EditorMode): void => {
    this.#callbacks.onEditorModeChange(mode);
  };

  publish = (command: PublicationCommand): PublicationResult =>
    this.#callbacks.onPublishMarkdown(command);
}

class CrepeRuntimeOwner {
  #runtime: CrepeRuntime | undefined;

  set(runtime: CrepeRuntime): void {
    this.#runtime = runtime;
  }

  clear(runtime: CrepeRuntime): void {
    if (this.#runtime === runtime) {
      this.#runtime = undefined;
    }
  }

  require(): CrepeRuntime {
    if (this.#runtime === undefined) {
      throw new Error("The Crepe runtime is not ready.");
    }
    return this.#runtime;
  }
}

class EditorRootOwner {
  #element: HTMLDivElement | null = null;

  set: RefCallback<HTMLDivElement> = (element) => {
    this.#element = element;
  };

  get(): HTMLDivElement | null {
    return this.#element;
  }
}
