// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SanitizedMarkdown } from "../src/components/SanitizedMarkdown.js";
import { renderMarkdownToSafeHtml } from "../src/markdown-renderer.js";

vi.mock("../src/markdown-renderer.js", () => ({
  renderMarkdownToSafeHtml: vi.fn(),
}));

const renderMarkdownToSafeHtmlMock = vi.mocked(renderMarkdownToSafeHtml);

afterEach(() => {
  cleanup();
  renderMarkdownToSafeHtmlMock.mockReset();
});

describe("SanitizedMarkdown", () => {
  it("keeps rendered HTML visible while changed markdown renders", async () => {
    const firstRender = createDeferredHtml();
    const secondRender = createDeferredHtml();
    renderMarkdownToSafeHtmlMock
      .mockReturnValueOnce(firstRender.promise)
      .mockReturnValueOnce(secondRender.promise);

    const { rerender } = render(<SanitizedMarkdown markdown="# First" />);

    expect(screen.getByText("Rendering...")).toBeInTheDocument();
    firstRender.resolve("<h1>First</h1><p>Already rendered.</p>");
    expect(await screen.findByText("Already rendered.")).toBeInTheDocument();

    rerender(<SanitizedMarkdown markdown="# Second" />);

    expect(screen.queryByText("Rendering...")).not.toBeInTheDocument();
    expect(screen.getByText("Already rendered.")).toBeInTheDocument();
    secondRender.resolve("<h1>Second</h1><p>Freshly rendered.</p>");
    await waitFor(() => {
      expect(screen.getByText("Freshly rendered.")).toBeInTheDocument();
    });
  });
});

function createDeferredHtml(): {
  readonly promise: Promise<string>;
  readonly resolve: (html: string) => void;
} {
  let resolveDeferred: (html: string) => void = () => {};
  const promise = new Promise<string>((resolve) => {
    resolveDeferred = resolve;
  });

  return {
    promise,
    resolve: resolveDeferred,
  };
}
