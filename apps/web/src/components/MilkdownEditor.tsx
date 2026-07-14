import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import type { ReactElement, RefCallback } from "react";
import { useId } from "react";

import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type {
  EditorSession,
  EditorSessionReader,
} from "../state/note-browser-types.js";
import type { CrepeRuntimeFactory } from "./crepe-runtime.js";
import type { EditorSessionGate } from "./editor-session-gate.js";
import { useMilkdownEditorController } from "./use-milkdown-editor-controller.js";

/** Immutable inputs that establish one production editor session. */
export type MilkdownEditorProps = {
  readonly createRuntime?: CrepeRuntimeFactory;
  readonly editor: EditorSession;
  readonly onEditorModeChange: (
    editorMode: EditorSession["editorMode"],
  ) => void;
  readonly onPublishMarkdown: (
    command: PublicationCommand,
  ) => PublicationResult;
  readonly readEditorSession: EditorSessionReader;
  readonly sessionGate: EditorSessionGate;
};

/** Editable Crepe surface whose lifetime is one exact editor session. */
export function MilkdownEditor(props: MilkdownEditorProps): ReactElement {
  return <MilkdownEditorSession key={props.editor.sessionKey} {...props} />;
}

function MilkdownEditorSession(props: MilkdownEditorProps): ReactElement {
  const sourceInputId = useId();
  const editor = useMilkdownEditorController(props);

  return (
    <div
      className="azurite-editor-surface"
      data-editor-session={props.editor.sessionKey}
      data-note-id={props.editor.note.id}
    >
      <EditorModeToolbar
        isReady={editor.isEditorReady}
        isSourceMode={editor.isSourceMode}
        onShowSource={editor.showSourceMode}
        onShowWysiwyg={editor.showWysiwygMode}
      />
      <EditorStatus
        error={editor.editorError}
        hasPublicationRetry={editor.hasPublicationRetry}
        isReady={editor.isEditorReady}
        onRetry={editor.retryPublication}
      />
      <EditorModeBody
        isSourceMode={editor.isSourceMode}
        onSourceChange={editor.updateSourceMarkdown}
        setEditorRoot={editor.setEditorRoot}
        sourceInputId={sourceInputId}
        sourceMarkdown={editor.sourceMarkdown}
        title={props.editor.note.title}
      />
    </div>
  );
}

function EditorModeToolbar(props: {
  readonly isReady: boolean;
  readonly isSourceMode: boolean;
  readonly onShowSource: () => void;
  readonly onShowWysiwyg: () => void;
}): ReactElement {
  return (
    <div className="mb-4 flex justify-end">
      <div
        aria-label="Editor mode"
        className="inline-flex w-fit border border-[var(--azurite-border)] bg-[var(--azurite-surface)] p-1"
        role="group"
      >
        <EditorModeButton
          disabled={!props.isReady}
          isActive={!props.isSourceMode}
          label="WYSIWYG"
          onClick={props.onShowWysiwyg}
        />
        <EditorModeButton
          disabled={false}
          isActive={props.isSourceMode}
          label="Markdown"
          onClick={props.onShowSource}
        />
      </div>
    </div>
  );
}

function EditorStatus(props: {
  readonly error: string | undefined;
  readonly hasPublicationRetry: boolean;
  readonly isReady: boolean;
  readonly onRetry: () => void;
}): ReactElement | null {
  if (props.error !== undefined) {
    return <EditorError {...props} error={props.error} />;
  }
  if (props.isReady) {
    return null;
  }
  return (
    <p className="mb-4 text-sm text-[var(--azurite-muted)]">
      Preparing editor...
    </p>
  );
}

function EditorError(props: {
  readonly error: string;
  readonly hasPublicationRetry: boolean;
  readonly onRetry: () => void;
}): ReactElement {
  return (
    <div className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p>{props.error}</p>
      {props.hasPublicationRetry ? (
        <button
          className="mt-2 underline"
          onClick={props.onRetry}
          type="button"
        >
          Retry editor change
        </button>
      ) : null}
    </div>
  );
}

function EditorModeBody(props: {
  readonly isSourceMode: boolean;
  readonly onSourceChange: (markdown: string) => void;
  readonly setEditorRoot: RefCallback<HTMLDivElement>;
  readonly sourceInputId: string;
  readonly sourceMarkdown: string;
  readonly title: string;
}): ReactElement {
  return (
    <>
      <EditorRoot
        isSourceMode={props.isSourceMode}
        setEditorRoot={props.setEditorRoot}
      />
      <SourceEditor
        isSourceMode={props.isSourceMode}
        onSourceChange={props.onSourceChange}
        sourceInputId={props.sourceInputId}
        sourceMarkdown={props.sourceMarkdown}
        title={props.title}
      />
    </>
  );
}

function EditorRoot({
  isSourceMode,
  setEditorRoot,
}: {
  readonly isSourceMode: boolean;
  readonly setEditorRoot: RefCallback<HTMLDivElement>;
}): ReactElement {
  return (
    <div
      aria-hidden={isSourceMode}
      className={isSourceMode ? "hidden" : undefined}
      data-testid="milkdown-editor-root"
      ref={setEditorRoot}
    />
  );
}

function SourceEditor(props: {
  readonly isSourceMode: boolean;
  readonly onSourceChange: (markdown: string) => void;
  readonly sourceInputId: string;
  readonly sourceMarkdown: string;
  readonly title: string;
}): ReactElement | null {
  if (!props.isSourceMode) {
    return null;
  }
  return (
    <div>
      <label className="sr-only" htmlFor={props.sourceInputId}>
        Markdown source for {props.title}
      </label>
      <textarea
        className="min-h-[28rem] w-full resize-y border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-4 py-3 font-mono text-sm leading-6 text-[var(--azurite-text)] outline-none focus:border-[var(--azurite-accent)]"
        id={props.sourceInputId}
        onChange={(event) => {
          props.onSourceChange(event.currentTarget.value);
        }}
        spellCheck={false}
        value={props.sourceMarkdown}
      />
    </div>
  );
}

function EditorModeButton(props: {
  readonly disabled: boolean;
  readonly isActive: boolean;
  readonly label: string;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      aria-pressed={props.isActive}
      className={
        props.isActive
          ? "bg-[var(--azurite-selected)] px-3 py-1.5 text-sm font-medium text-[var(--azurite-selected-text)]"
          : "px-3 py-1.5 text-sm font-medium text-[var(--azurite-muted)] hover:bg-[var(--azurite-hover)] hover:text-[var(--azurite-text)] disabled:cursor-not-allowed disabled:opacity-50"
      }
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}
