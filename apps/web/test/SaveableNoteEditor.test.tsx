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

import { apiErrorCodes, type NoteContentWithHash } from "@azurite/shared";
import { WebApiError } from "../src/api-client.js";
import { SaveableNoteEditor } from "../src/components/SaveableNoteEditor.js";

vi.mock("../src/components/MilkdownEditor.js", () => ({
  MilkdownEditor: ({
    initialMarkdown,
    onMarkdownChange,
    title,
  }: {
    readonly initialMarkdown: string;
    readonly onMarkdownChange?: (markdown: string) => void;
    readonly title: string;
  }) => (
    <textarea
      aria-label={`Editor markdown for ${title}`}
      defaultValue={initialMarkdown}
      onChange={(event) => {
        onMarkdownChange?.(event.currentTarget.value);
      }}
    />
  ),
}));

const initialNote = {
  contentHash: "sha256-before",
  fileName: "index.md",
  id: "index.md",
  lastModifiedAt: "2026-07-07T12:00:00.000Z",
  markdown: "# Home\n",
  relativePath: "index.md",
  sizeBytes: 7,
  title: "Home",
} satisfies NoteContentWithHash;

afterEach(() => {
  cleanup();
});

describe("SaveableNoteEditor save success", () => {
  it("saves current markdown and clears dirty state", async () => {
    const onSaveNote = vi.fn(() =>
      Promise.resolve({
        ...initialNote,
        contentHash: "sha256-after",
        markdown: "# Updated\n",
        sizeBytes: 10,
        title: "Updated",
      }),
    );

    render(<SaveableNoteEditor note={initialNote} onSaveNote={onSaveNote} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Editor markdown for Home"), {
      target: { value: "# Updated\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSaveNote).toHaveBeenCalledWith({
        expectedContentHash: "sha256-before",
        markdown: "# Updated\n",
        noteId: "index.md",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("SaveableNoteEditor save guards", () => {
  it("does not mark editor-normalized line endings as dirty", () => {
    const onSaveNote = vi.fn();
    const crlfNote = {
      ...initialNote,
      markdown: "# Home\r\n\r\nBody\r\n",
      sizeBytes: 16,
    } satisfies NoteContentWithHash;

    render(<SaveableNoteEditor note={crlfNote} onSaveNote={onSaveNote} />);

    fireEvent.change(screen.getByLabelText("Editor markdown for Home"), {
      target: { value: "# Home\n\nBody\n" },
    });

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("keeps unsaved content visible after a conflict", async () => {
    const onSaveNote = vi.fn(() =>
      Promise.reject(
        new WebApiError(
          "The note changed on disk before Azurite could save it.",
          {
            code: apiErrorCodes.noteWriteConflict,
            statusCode: 409,
          },
        ),
      ),
    );

    render(<SaveableNoteEditor note={initialNote} onSaveNote={onSaveNote} />);

    const editor = screen.getByLabelText("Editor markdown for Home");
    fireEvent.change(editor, {
      target: { value: "# Local draft\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Changed on disk")).toBeInTheDocument();
    expect(editor).toHaveValue("# Local draft\n");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
