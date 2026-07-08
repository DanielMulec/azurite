import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { replaceAll } from "@milkdown/kit/utils";
import type { ReactElement, RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

type EditorMode = "source" | "wysiwyg";
type StoredEditorMode = "markdown" | "wysiwyg";

type MilkdownEditorProps = {
  readonly initialMode: StoredEditorMode;
  readonly initialMarkdown: string;
  readonly noteId: string;
  readonly onEditorModeChange?: (editorMode: StoredEditorMode) => void;
  readonly onMarkdownChange?: (markdown: string) => void;
  readonly title: string;
};

type MilkdownEditorControllerInput = {
  readonly initialMode: StoredEditorMode;
  readonly initialMarkdown: string;
  readonly noteId: string;
  readonly onEditorModeChange: MilkdownEditorProps["onEditorModeChange"];
  readonly onMarkdownChange: MilkdownEditorProps["onMarkdownChange"];
};

/** Editable Milkdown and Crepe surface for one selected markdown note. */
export function MilkdownEditor({
  initialMode,
  initialMarkdown,
  noteId,
  onEditorModeChange,
  onMarkdownChange,
  title,
}: MilkdownEditorProps): ReactElement {
  const editor = useMilkdownEditorController({
    initialMarkdown,
    initialMode,
    noteId,
    onEditorModeChange,
    onMarkdownChange,
  });

  return (
    <div className="azurite-editor-surface">
      <EditorModeToolbar
        isSourceMode={editor.isSourceMode}
        onShowSource={editor.showSourceMode}
        onShowWysiwyg={editor.showWysiwygMode}
      />
      <EditorStatus error={editor.editorError} isReady={editor.isEditorReady} />
      <EditorModeBody
        isSourceMode={editor.isSourceMode}
        onSourceChange={editor.updateMarkdown}
        rootRef={editor.rootRef}
        sourceInputId={editor.sourceInputId}
        sourceMarkdown={editor.sourceMarkdown}
        title={title}
      />
    </div>
  );
}

function useMilkdownEditorController({
  initialMode,
  initialMarkdown,
  noteId,
  onEditorModeChange,
  onMarkdownChange,
}: MilkdownEditorControllerInput) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const sourceInputId = useId();
  const [editorError, setEditorError] = useState<string | undefined>();
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [mode, setMode] = useState<EditorMode>(toLocalEditorMode(initialMode));
  const [sourceMarkdown, setSourceMarkdown] = useState(initialMarkdown);
  const updateMode = useCallback(
    (nextMode: EditorMode) => {
      setMode(nextMode);
      onEditorModeChange?.(toStoredEditorMode(nextMode));
    },
    [onEditorModeChange],
  );
  const updateMarkdown = useCallback(
    (markdown: string) => {
      setSourceMarkdown(markdown);
      onMarkdownChange?.(markdown);
    },
    [onMarkdownChange],
  );

  useEffect(() => {
    return createCrepeEditor({
      initialMarkdown,
      initialMode: toLocalEditorMode(initialMode),
      onEditorError: setEditorError,
      onMarkdownChange: updateMarkdown,
      onReady: setIsEditorReady,
      root: rootRef.current,
      setMode: updateMode,
      target: crepeRef,
    });
  }, [initialMarkdown, initialMode, noteId, updateMarkdown, updateMode]);

  const isSourceMode = mode === "source";

  return {
    editorError,
    isEditorReady,
    isSourceMode,
    rootRef,
    showSourceMode: () => {
      updateMarkdown(getCurrentMarkdown(crepeRef.current));
      updateMode("source");
    },
    showWysiwygMode: () => {
      applySourceMarkdown(crepeRef.current, sourceMarkdown);
      updateMode("wysiwyg");
    },
    sourceInputId,
    sourceMarkdown,
    updateMarkdown,
  };
}

function EditorModeToolbar({
  isSourceMode,
  onShowSource,
  onShowWysiwyg,
}: {
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
          isActive={!isSourceMode}
          label="WYSIWYG"
          onClick={onShowWysiwyg}
        />
        <EditorModeButton
          isActive={isSourceMode}
          label="Markdown"
          onClick={onShowSource}
        />
      </div>
    </div>
  );
}

function EditorStatus({
  error,
  isReady,
}: {
  readonly error: string | undefined;
  readonly isReady: boolean;
}): ReactElement | null {
  if (error !== undefined) {
    return (
      <p className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    );
  }

  if (!isReady) {
    return (
      <p className="mb-4 text-sm text-[var(--azurite-muted)]">
        Preparing editor...
      </p>
    );
  }

  return null;
}

function EditorModeBody({
  isSourceMode,
  onSourceChange,
  rootRef,
  sourceInputId,
  sourceMarkdown,
  title,
}: {
  readonly isSourceMode: boolean;
  readonly onSourceChange: (markdown: string) => void;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly sourceInputId: string;
  readonly sourceMarkdown: string;
  readonly title: string;
}): ReactElement {
  return (
    <>
      <div
        aria-hidden={isSourceMode}
        className={isSourceMode ? "hidden" : undefined}
        data-testid="milkdown-editor-root"
        ref={rootRef}
      />
      {isSourceMode ? (
        <SourceMarkdownEditor
          inputId={sourceInputId}
          markdown={sourceMarkdown}
          onChange={onSourceChange}
          title={title}
        />
      ) : null}
    </>
  );
}

function SourceMarkdownEditor({
  inputId,
  markdown,
  onChange,
  title,
}: {
  readonly inputId: string;
  readonly markdown: string;
  readonly onChange: (markdown: string) => void;
  readonly title: string;
}): ReactElement {
  return (
    <div>
      <label className="sr-only" htmlFor={inputId}>
        Markdown source for {title}
      </label>
      <textarea
        className="min-h-[28rem] w-full resize-y border border-[var(--azurite-border)] bg-[var(--azurite-surface)] px-4 py-3 font-mono text-sm leading-6 text-[var(--azurite-text)] outline-none focus:border-[var(--azurite-accent)]"
        id={inputId}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        spellCheck={false}
        value={markdown}
      />
    </div>
  );
}

function EditorModeButton({
  isActive,
  label,
  onClick,
}: {
  readonly isActive: boolean;
  readonly label: string;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      aria-pressed={isActive}
      className={
        isActive
          ? "bg-[var(--azurite-selected)] px-3 py-1.5 text-sm font-medium text-[var(--azurite-selected-text)]"
          : "px-3 py-1.5 text-sm font-medium text-[var(--azurite-muted)] hover:bg-[var(--azurite-hover)] hover:text-[var(--azurite-text)]"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function createCrepeEditor({
  initialMode,
  initialMarkdown,
  onEditorError,
  onMarkdownChange,
  onReady,
  root,
  setMode,
  target,
}: {
  readonly initialMode: EditorMode;
  readonly initialMarkdown: string;
  readonly onEditorError: (message: string | undefined) => void;
  readonly onMarkdownChange: (markdown: string) => void;
  readonly onReady: (isReady: boolean) => void;
  readonly root: HTMLDivElement | null;
  readonly setMode: (mode: EditorMode) => void;
  readonly target: RefObject<Crepe | null>;
}): () => void {
  let isActive = true;
  onEditorError(undefined);
  onMarkdownChange(initialMarkdown);
  onReady(false);
  setMode(initialMode);
  target.current = null;
  if (root === null) {
    onEditorError("The editor root was not available.");
    return noop;
  }

  const crepe = createConfiguredCrepe({
    initialMarkdown,
    onMarkdownChange,
    root,
    shouldAcceptUpdate: () => isActive,
  });

  void crepe.create().then(
    () => {
      if (!isActive) {
        destroyCrepe(crepe);
        return;
      }

      target.current = crepe;
      onReady(true);
    },
    () => {
      if (isActive) {
        onEditorError("The Milkdown editor could not be created.");
      }
      destroyCrepe(crepe);
    },
  );

  return () => {
    isActive = false;
    target.current = null;
    destroyCrepe(crepe);
  };
}

function createConfiguredCrepe({
  initialMarkdown,
  onMarkdownChange,
  root,
  shouldAcceptUpdate,
}: {
  readonly initialMarkdown: string;
  readonly onMarkdownChange: (markdown: string) => void;
  readonly root: HTMLDivElement;
  readonly shouldAcceptUpdate: () => boolean;
}): Crepe {
  root.replaceChildren();
  const crepe = new Crepe({
    defaultValue: initialMarkdown,
    root,
  });
  crepe.on((listener) => {
    listener.markdownUpdated((_context, markdown) => {
      if (shouldAcceptUpdate()) {
        onMarkdownChange(markdown);
      }
    });
  });
  return crepe;
}

function getCurrentMarkdown(crepe: Crepe | null): string {
  return crepe?.getMarkdown() ?? "";
}

function applySourceMarkdown(crepe: Crepe | null, markdown: string): void {
  crepe?.editor.action(replaceAll(markdown, true));
}

function destroyCrepe(crepe: Crepe): void {
  void crepe.destroy().catch(noop);
}

function noop(): void {}

function toLocalEditorMode(editorMode: StoredEditorMode): EditorMode {
  return editorMode === "markdown" ? "source" : "wysiwyg";
}

function toStoredEditorMode(editorMode: EditorMode): StoredEditorMode {
  return editorMode === "source" ? "markdown" : "wysiwyg";
}
