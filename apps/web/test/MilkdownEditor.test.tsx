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
import {
  createAcknowledgingPublisher,
  createTestEditorSessionGate,
} from "./editor-session-gate-test-helpers.js";
import {
  createDeferred,
  createNote,
} from "./note-browser-store-test-helpers.js";

type MockFunction = ReturnType<typeof vi.fn>;
type MockCrepeInstance = {
  readonly config: MockCrepeConfig;
  readonly create: MockFunction;
  readonly destroy: MockFunction;
  readonly editor: { readonly action: MockFunction };
  markdown: string;
};
const replaceAllMock = vi.hoisted(() => vi.fn());
const crepeInstances = vi.hoisted(() => [] as MockCrepeInstance[]);
vi.mock("@milkdown/kit/utils", () => ({
  replaceAll: replaceAllMock,
}));
vi.mock("@milkdown/crepe", () => ({
  Crepe: class MockCrepe {
    static Feature = {};
    readonly config: MockCrepeConfig;
    readonly destroy = vi.fn(async () => {});
    readonly create = vi.fn(async () => {});
    readonly editor = {
      action: vi.fn((action: (context: string) => void) => {
        action("mock-context");
      }),
    };
    markdown = "";
    markdownUpdated: ((markdown: string) => void) | undefined;
    constructor(config: MockCrepeConfig) {
      this.config = config;
      this.markdown = config.defaultValue;
      crepeInstances.push(this);
    }
    getMarkdown(): string {
      return this.markdown;
    }
    on(register: (listener: MockListener) => void): this {
      register({
        markdownUpdated: (callback) => {
          this.markdownUpdated = (markdown) => {
            callback("mock-context", markdown, this.markdown);
            this.markdown = markdown;
          };
        },
      });
      return this;
    }
  },
}));

afterEach(() => {
  cleanup();
  crepeInstances.length = 0;
  replaceAllMock.mockReset();
});

describe("MilkdownEditor lifecycle", () => {
  it("creates and destroys a Crepe editor with the selected markdown", async () => {
    const publish = vi.fn(createAcknowledgingPublisher());
    const { unmount } = render(
      <SessionEditor
        editor={createEditorSession()}
        onPublishMarkdown={publish}
        sessionGate={createTestEditorSessionGate()}
      />,
    );
    await waitFor(() => {
      expect(crepeInstances).toHaveLength(2);
      expect(crepeInstances[1]?.create).toHaveBeenCalledOnce();
    });
    expect(crepeInstances[0]?.destroy).toHaveBeenCalledOnce();
    expect(crepeInstances[1]?.config.defaultValue).toBe("# Home");
    expect(crepeInstances[1]?.destroy).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    unmount();
    expect(crepeInstances[1]?.destroy).toHaveBeenCalledOnce();
  });
});

describe("MilkdownEditor replacement", () => {
  it("recreates the editor when the selected note changes", async () => {
    const home = createEditorSession();
    const project = createEditorSession({
      currentMarkdown: "# Project",
      note: createNote("Projects/azurite.md", "# Project", "sha256-project"),
      savedMarkdown: "# Project",
      sessionKey: "Projects/azurite.md:1",
    });
    const { rerender } = render(
      <SessionEditor
        editor={home}
        sessionGate={createTestEditorSessionGate()}
      />,
    );
    await waitFor(() => {
      expect(crepeInstances).toHaveLength(2);
      expect(crepeInstances[1]?.create).toHaveBeenCalledOnce();
    });
    rerender(
      <SessionEditor
        key={project.sessionKey}
        editor={project}
        sessionGate={createTestEditorSessionGate()}
      />,
    );

    await waitFor(() => {
      expect(crepeInstances).toHaveLength(4);
      expect(crepeInstances[3]?.create).toHaveBeenCalledOnce();
    });
    expect(crepeInstances[1]?.destroy).toHaveBeenCalledOnce();
    expect(crepeInstances[2]?.destroy).toHaveBeenCalledOnce();
    expect(crepeInstances[3]?.config.defaultValue).toBe("# Project");
    expect(crepeInstances[3]?.destroy).not.toHaveBeenCalled();
  });
});

describe("MilkdownEditor session stability", () => {
  it("retains one Crepe instance across same-session product rerenders", async () => {
    const gate = createTestEditorSessionGate();
    const publish = createAcknowledgingPublisher();
    let editor = createEditorSession({ sessionKey: "index.md:stable" });
    const renderCurrentEditor = () => (
      <MilkdownEditor
        editor={editor}
        onEditorModeChange={() => {}}
        onPublishMarkdown={publish}
        readEditorSession={(sessionKey) =>
          sessionKey === editor.sessionKey ? editor : undefined
        }
        sessionGate={gate}
      />
    );
    const { rerender } = render(renderCurrentEditor());
    await waitFor(() => {
      expect(crepeInstances).toHaveLength(2);
      expect(crepeInstances[1]?.create).toHaveBeenCalledOnce();
    });
    expect(crepeInstances[0]?.destroy).toHaveBeenCalledOnce();

    editor = {
      ...editor,
      currentMarkdown: "# Same live document",
      draftDisposition: "generated_durable",
      revision: 4,
    };
    rerender(renderCurrentEditor());

    expect(crepeInstances).toHaveLength(2);
    expect(crepeInstances[1]?.destroy).not.toHaveBeenCalled();
  });
});

describe("MilkdownEditor controllable creation", () => {
  it("keeps exact source editable while create is pending", async () => {
    const create = createDeferred<undefined>();
    const onEditorModeChange = vi.fn();
    let markdown = "# Stale construction";
    const replaceMarkdown = vi.fn((next: string) => {
      markdown = next;
    });
    const createRuntime = vi.fn<CrepeRuntimeFactory>(() => ({
      create: () => create.promise,
      destroy: () => Promise.resolve(),
      getMarkdown: () => markdown,
      replaceMarkdown,
    }));
    const publish = vi.fn(createAcknowledgingPublisher());

    render(
      <SessionEditor
        createRuntime={createRuntime}
        editor={createEditorSession({
          currentMarkdown: "# Exact source",
          savedMarkdown: "# Exact source",
          sessionKey: "pending-session",
        })}
        onEditorModeChange={onEditorModeChange}
        onPublishMarkdown={publish}
        sessionGate={createTestEditorSessionGate()}
      />,
    );
    expect(screen.queryByLabelText("Markdown source for Home")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    const source = screen.getByLabelText("Markdown source for Home");
    fireEvent.change(source, { target: { value: "# Pre-ready edit" } });

    expect(source).toHaveValue("# Pre-ready edit");
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();
    expect(publish).toHaveBeenCalledOnce();
    expect(onEditorModeChange).toHaveBeenCalledOnce();
    create.resolve(undefined);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "WYSIWYG" }));

    expect(replaceMarkdown).toHaveBeenCalledWith("# Pre-ready edit");
    expect(publish).toHaveBeenCalledOnce();
    expect(onEditorModeChange).toHaveBeenCalledTimes(2);
  });
});

describe("MilkdownEditor creation failure", () => {
  it("keeps exact source visible when Crepe creation rejects", async () => {
    const createRuntime = vi.fn<CrepeRuntimeFactory>(() => ({
      create: () => Promise.reject(new Error("Injected create failure.")),
      destroy: () => Promise.resolve(),
      getMarkdown: () => "# Stale",
      replaceMarkdown: () => {},
    }));
    const publish = vi.fn(createAcknowledgingPublisher());

    render(
      <SessionEditor
        createRuntime={createRuntime}
        editor={createEditorSession({
          currentMarkdown: "# Exact survives",
          savedMarkdown: "# Exact survives",
          sessionKey: "failed-session",
        })}
        onPublishMarkdown={publish}
        sessionGate={createTestEditorSessionGate()}
      />,
    );

    expect(
      await screen.findByText("The Milkdown editor could not be created."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown source for Home")).toHaveValue(
      "# Exact survives",
    );
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("MilkdownEditor source mode", () => {
  it("shows current editor markdown in source mode and applies local edits", async () => {
    const publish = vi.fn(createAcknowledgingPublisher());
    replaceAllMock.mockReturnValue((context: string) => {
      expect(context).toBe("mock-context");
    });

    render(
      <SessionEditor
        editor={createEditorSession()}
        onPublishMarkdown={publish}
        sessionGate={createTestEditorSessionGate()}
      />,
    );

    await waitFor(() => {
      expect(crepeInstances).toHaveLength(2);
      expect(crepeInstances[1]?.create).toHaveBeenCalledOnce();
    });
    setCurrentCrepeMarkdown("# Edited in WYSIWYG");

    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    expect(publish).toHaveBeenCalledOnce();
    const source = screen.getByLabelText("Markdown source for Home");
    expect(source).toHaveValue("# Edited in WYSIWYG");

    fireEvent.change(source, {
      target: { value: "# Edited in source" },
    });
    fireEvent.click(screen.getByRole("button", { name: "WYSIWYG" }));

    expect(replaceAllMock).toHaveBeenCalledWith("# Edited in source", true);
    expect(crepeInstances[1]?.editor.action).toHaveBeenCalledOnce();
  });
});

function setCurrentCrepeMarkdown(markdown: string): void {
  const currentCrepe = crepeInstances.at(-1);

  if (currentCrepe === undefined) {
    throw new Error("Expected a Crepe instance.");
  }

  currentCrepe.markdown = markdown;
}

type SessionEditorProps = Omit<
  MilkdownEditorProps,
  "editor" | "onEditorModeChange" | "onPublishMarkdown" | "readEditorSession"
> & {
  readonly editor: EditorSession;
  readonly onEditorModeChange?: MilkdownEditorProps["onEditorModeChange"];
  readonly onPublishMarkdown?: MilkdownEditorProps["onPublishMarkdown"];
};

function SessionEditor(props: SessionEditorProps) {
  const [editor, setEditorState] = useState(props.editor);
  const editorRef = useRef(editor);
  const updateEditor = (next: EditorSession): void => {
    editorRef.current = next;
    setEditorState(next);
  };
  const onEditorModeChange: MilkdownEditorProps["onEditorModeChange"] = (
    editorMode,
  ) => {
    updateEditor({ ...editorRef.current, editorMode });
    props.onEditorModeChange?.(editorMode);
  };
  const onPublishMarkdown: MilkdownEditorProps["onPublishMarkdown"] = (
    command,
  ) => {
    const result = props.onPublishMarkdown?.(command) ?? { status: "accepted" };
    if (result.status === "accepted") {
      updateEditor({
        ...editorRef.current,
        currentMarkdown: command.markdown,
        revision: editorRef.current.revision + 1,
      });
    }
    return result;
  };
  return (
    <MilkdownEditor
      {...props}
      editor={editor}
      onEditorModeChange={onEditorModeChange}
      onPublishMarkdown={onPublishMarkdown}
      readEditorSession={(sessionKey) =>
        editorRef.current.sessionKey === sessionKey
          ? editorRef.current
          : undefined
      }
    />
  );
}

function createEditorSession(
  patch: Partial<EditorSession> = {},
): EditorSession {
  const markdown = patch.currentMarkdown ?? "# Home";
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
    sessionKey: "index.md:1",
    ...patch,
  };
}

type MockCrepeConfig = {
  readonly defaultValue: string;
  readonly root: Node | string | null;
};

type MockListener = {
  readonly markdownUpdated: (
    callback: (
      context: string,
      markdown: string,
      previousMarkdown: string,
    ) => void,
  ) => void;
};
