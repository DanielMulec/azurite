// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MilkdownEditor,
  type MilkdownEditorProps,
} from "../src/components/MilkdownEditor.js";
import type { CrepeRuntimeFactory } from "../src/components/crepe-runtime.js";
import type { EditorSession } from "../src/state/note-browser-types.js";
import { createTestEditorSessionGate } from "./editor-session-gate-test-helpers.js";
import {
  createDeferred,
  createNote,
} from "./note-browser-store-test-helpers.js";

afterEach(cleanup);

describe("MilkdownEditor rejected source publication", () => {
  it("preserves visible retry state through readiness and blocks WYSIWYG", async () => {
    const creation = createDeferred<undefined>();
    let projection = "# Accepted";
    const replaceProjection = vi.fn((markdown: string) => {
      projection = markdown;
    });
    const createRuntime = vi.fn<CrepeRuntimeFactory>(() => ({
      create: () => creation.promise,
      destroy: () => Promise.resolve(),
      getMarkdown: () => projection,
      replaceMarkdown: replaceProjection,
    }));
    const publish = vi.fn(() => ({
      reason: "snapshot_admission_failed" as const,
      status: "rejected" as const,
    }));

    render(
      <SessionEditor
        createRuntime={createRuntime}
        editor={createEditorSession()}
        onPublishMarkdown={publish}
        sessionGate={createTestEditorSessionGate()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    const source = screen.getByLabelText("Markdown source for Home");
    fireEvent.change(source, { target: { value: "# Visible rejected" } });

    expect(source).toHaveValue("# Visible rejected");
    expect(
      screen.getByText("The latest editor change has not been acknowledged."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry editor change" }),
    ).toBeInTheDocument();

    creation.resolve(undefined);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeEnabled();
    });

    expect(source).toHaveValue("# Visible rejected");
    expect(
      screen.getByText("The latest editor change has not been acknowledged."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry editor change" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "WYSIWYG" }));

    expect(source).toHaveValue("# Visible rejected");
    expect(replaceProjection).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Markdown" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(publish).toHaveBeenCalledOnce();
  });
});

type SessionEditorProps = Omit<
  MilkdownEditorProps,
  "editor" | "onEditorModeChange" | "onPublishMarkdown" | "readEditorSession"
> & {
  readonly editor: EditorSession;
  readonly onPublishMarkdown: MilkdownEditorProps["onPublishMarkdown"];
};

function SessionEditor(props: SessionEditorProps) {
  const [editor, setEditorState] = useState(props.editor);
  const editorRef = useRef(editor);
  const updateEditor = (next: EditorSession): void => {
    editorRef.current = next;
    setEditorState(next);
  };
  return (
    <MilkdownEditor
      {...props}
      editor={editor}
      onEditorModeChange={(editorMode) => {
        updateEditor({ ...editorRef.current, editorMode });
      }}
      onPublishMarkdown={(command) => {
        const result = props.onPublishMarkdown(command);
        if (result.status === "accepted") {
          updateEditor({
            ...editorRef.current,
            currentMarkdown: command.markdown,
            revision: editorRef.current.revision + 1,
          });
        }
        return result;
      }}
      readEditorSession={(sessionKey) =>
        editorRef.current.sessionKey === sessionKey
          ? editorRef.current
          : undefined
      }
    />
  );
}

function createEditorSession(): EditorSession {
  const markdown = "# Accepted";
  return {
    baseContentHash: "sha256-home",
    currentMarkdown: markdown,
    draftDisposition: "none",
    draftEpoch: 0,
    durableSnapshotKey: undefined,
    editorMode: "wysiwyg",
    lastSnapshotKey: undefined,
    note: createNote("index.md", markdown, "sha256-home"),
    persistenceIssue: undefined,
    preservedSchemaVersion: undefined,
    revision: 0,
    savedMarkdown: markdown,
    saveStatus: "idle",
    sessionKey: "index.md:rejected-publication",
  };
}
