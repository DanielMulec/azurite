// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MilkdownEditor } from "../src/components/MilkdownEditor.js";

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
    const { unmount } = render(
      <MilkdownEditor
        initialMarkdown="# Home"
        noteId="index.md"
        title="Home"
      />,
    );

    await waitFor(() => {
      expect(crepeInstances[0]?.create).toHaveBeenCalled();
    });
    expect(crepeInstances[0]?.config.defaultValue).toBe("# Home");

    unmount();

    expect(crepeInstances[0]?.destroy).toHaveBeenCalled();
  });

  it("recreates the editor when the selected note changes", async () => {
    const { rerender } = render(
      <MilkdownEditor
        initialMarkdown="# Home"
        noteId="index.md"
        title="Home"
      />,
    );

    await waitFor(() => {
      expect(crepeInstances[0]?.create).toHaveBeenCalled();
    });
    rerender(
      <MilkdownEditor
        initialMarkdown="# Project"
        noteId="Projects/azurite.md"
        title="Project"
      />,
    );

    await waitFor(() => {
      expect(crepeInstances).toHaveLength(2);
    });
    expect(crepeInstances[0]?.destroy).toHaveBeenCalled();
    expect(crepeInstances[1]?.config.defaultValue).toBe("# Project");
  });
});

describe("MilkdownEditor source mode", () => {
  it("shows current editor markdown in source mode and applies local edits", async () => {
    replaceAllMock.mockReturnValue((context: string) => {
      expect(context).toBe("mock-context");
    });

    render(
      <MilkdownEditor
        initialMarkdown="# Home"
        noteId="index.md"
        title="Home"
      />,
    );

    await waitFor(() => {
      expect(crepeInstances[0]?.create).toHaveBeenCalled();
    });
    setFirstCrepeMarkdown("# Edited in WYSIWYG");

    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    const source = screen.getByLabelText("Markdown source for Home");
    expect(source).toHaveValue("# Edited in WYSIWYG");

    fireEvent.change(source, {
      target: { value: "# Edited in source" },
    });
    fireEvent.click(screen.getByRole("button", { name: "WYSIWYG" }));

    expect(replaceAllMock).toHaveBeenCalledWith("# Edited in source", true);
    expect(crepeInstances[0]?.editor.action).toHaveBeenCalled();
  });
});

function setFirstCrepeMarkdown(markdown: string): void {
  const firstCrepe = crepeInstances[0];

  if (firstCrepe === undefined) {
    throw new Error("Expected a Crepe instance.");
  }

  firstCrepe.markdown = markdown;
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
