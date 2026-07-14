import type { ReactElement } from "react";
import { useSyncExternalStore } from "react";

import { MilkdownEditor } from "../components/MilkdownEditor.js";
import type {
  EditorControllerCapability,
  EditorSessionGate,
} from "../components/editor-session-gate.js";
import type { MarkdownFidelityQaController } from "./markdown-fidelity-controller.js";

type MarkdownFidelityQaAppProps = {
  readonly controller: MarkdownFidelityQaController;
};

/** Dedicated non-product surface for pending and rejected Crepe creation. */
export function MarkdownFidelityQaApp({
  controller,
}: MarkdownFidelityQaAppProps): ReactElement {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const editor = controller.getEditorSession();
  return (
    <main
      className="mx-auto max-w-4xl p-5 md:p-8"
      data-qa-generation={snapshot.generation}
    >
      <header className="mb-6 border-b border-[var(--azurite-border)] pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--azurite-muted)]">
          Isolated test harness
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--azurite-heading)]">
          Markdown fidelity lifecycle QA
        </h1>
        <p className="mt-2 text-sm text-[var(--azurite-muted)]">
          This entry mounts the production editor outside Azurite's product
          router with a controlled Crepe factory.
        </p>
      </header>
      <LifecycleControls controller={controller} />
      <section className="mt-6 border border-[var(--azurite-border)] bg-[var(--azurite-reading-surface)] p-5">
        <MilkdownEditor
          createRuntime={controller.createRuntime}
          editor={editor}
          onEditorModeChange={controller.setMode}
          onPublishMarkdown={controller.acknowledge}
          readEditorSession={controller.readEditorSession}
          sessionGate={qaSessionGate}
        />
      </section>
    </main>
  );
}

function LifecycleControls({
  controller,
}: MarkdownFidelityQaAppProps): ReactElement {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const pending = snapshot.creationState === "pending";
  return (
    <aside className="border border-slate-600 bg-slate-950 p-4 text-sm text-slate-100">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt>Generation</dt>
        <dd data-testid="fidelity-qa-generation">{snapshot.generation}</dd>
        <dt>Creation</dt>
        <dd data-testid="fidelity-qa-creation">{snapshot.creationState}</dd>
        <dt>Publications</dt>
        <dd data-testid="fidelity-qa-publications">
          {snapshot.publicationCount}
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <ControlButton
          disabled={!pending}
          label="Resolve editor creation"
          onClick={controller.resolveCreation}
        />
        <ControlButton
          disabled={!pending}
          label="Reject editor creation"
          onClick={controller.rejectCreation}
        />
        <ControlButton
          label="Reset pending editor"
          onClick={controller.resetPending}
        />
      </div>
    </aside>
  );
}

function ControlButton(props: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      className="border border-slate-500 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}

const qaSessionGate = createQaSessionGate();

function createQaSessionGate(): EditorSessionGate {
  let activeController: EditorControllerCapability | undefined;
  return {
    commitCurrent: (cause) => activeController?.commit(cause),
    commitLifecycle: () => Promise.resolve(),
    getSnapshot: () => ({ frozenSessionKey: undefined, message: undefined }),
    isSessionFrozen: () => false,
    registerController: (controller) => {
      activeController = controller;
      return () => {
        if (activeController === controller) {
          activeController = undefined;
        }
      };
    },
    routeGate: {
      prepare: () => ({ status: "continue" }),
      settle: () => {},
    },
    runTerminalAction: async (_sessionKey, action) => {
      await action();
    },
    subscribe: () => () => {},
  };
}
