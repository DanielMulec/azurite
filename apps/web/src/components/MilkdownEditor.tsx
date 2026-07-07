import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { replaceAll } from "@milkdown/kit/utils";
import type { ReactElement, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";

type EditorMode = "source" | "wysiwyg";

type MilkdownEditorProps = {
  readonly initialMarkdown: string;
  readonly noteId: string;
  readonly title: string;
};

/** Editable Milkdown and Crepe surface for one selected markdown note. */
export function MilkdownEditor({
  initialMarkdown,
  noteId,
  title,
}: MilkdownEditorProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const sourceInputId = useId();
  const [editorError, setEditorError] = useState<string | undefined>();
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [mode, setMode] = useState<EditorMode>("wysiwyg");
  const [sourceMarkdown, setSourceMarkdown] = useState(initialMarkdown);

  useEffect(() => {
    return createCrepeEditor({
      initialMarkdown,
      onEditorError: setEditorError,
      onMarkdownChange: setSourceMarkdown,
      onReady: setIsEditorReady,
      root: rootRef.current,
      setMode,
      target: crepeRef,
    });
  }, [initialMarkdown, noteId]);

  const isSourceMode = mode === "source";

  return (
    <div className="azurite-editor-surface">
      <EditorModeToolbar
        isSourceMode={isSourceMode}
        onShowSource={() => {
          setSourceMarkdown(getCurrentMarkdown(crepeRef.current));
          setMode("source");
        }}
        onShowWysiwyg={() => {
          applySourceMarkdown(crepeRef.current, sourceMarkdown);
          setMode("wysiwyg");
        }}
      />
      <EditorStatus error={editorError} isReady={isEditorReady} />
      <EditorModeBody
        isSourceMode={isSourceMode}
        onSourceChange={setSourceMarkdown}
        rootRef={rootRef}
        sourceInputId={sourceInputId}
        sourceMarkdown={sourceMarkdown}
        title={title}
      />
    </div>
  );
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
    <div className="mb-4 flex flex-col gap-3 border-b border-[var(--azurite-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--azurite-muted)]">
        Local editing only. Saving arrives in the next slice.
      </p>
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
  initialMarkdown,
  onEditorError,
  onMarkdownChange,
  onReady,
  root,
  setMode,
  target,
}: {
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
  setMode("wysiwyg");
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
