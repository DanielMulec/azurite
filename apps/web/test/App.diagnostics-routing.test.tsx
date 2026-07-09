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

import { AzuriteRouterProvider } from "../src/app-router.js";

vi.mock("../src/App.js", () => ({
  App: ({
    devDiagnostics,
    navigation,
    routeNoteId,
  }: {
    readonly devDiagnostics?: "sentry-test";
    readonly navigation: {
      readonly pushSelectedNote: (noteId: string) => void;
      readonly replaceSelectedNote: (noteId: string) => void;
    };
    readonly routeNoteId: string | undefined;
  }) => (
    <main>
      <p data-testid="route-note">{routeNoteId}</p>
      <p data-testid="dev-diagnostics">{devDiagnostics}</p>
      <button
        onClick={() => {
          navigation.pushSelectedNote("Projects/azurite.md");
        }}
        type="button"
      >
        Push note
      </button>
      <button
        onClick={() => {
          navigation.replaceSelectedNote("Daily/today.md");
        }}
        type="button"
      >
        Replace note
      </button>
    </main>
  ),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("development diagnostics routing", () => {
  it("preserves the typed diagnostics value across push and history", async () => {
    window.history.replaceState(
      {},
      "",
      "/?note=index.md&azurite-dev=sentry-test",
    );
    render(<AzuriteRouterProvider />);

    expect(await screen.findByTestId("dev-diagnostics")).toHaveTextContent(
      "sentry-test",
    );
    fireEvent.click(screen.getByRole("button", { name: "Push note" }));
    await waitFor(() => {
      expect(window.location.search).toContain("azurite-dev=sentry-test");
      expect(window.location.search).toContain("note=Projects%2Fazurite.md");
    });

    window.history.back();
    await waitFor(() => {
      expect(screen.getByTestId("route-note")).toHaveTextContent("index.md");
      expect(window.location.search).toContain("azurite-dev=sentry-test");
    });
  });

  it("preserves the typed diagnostics value during replacement", async () => {
    window.history.replaceState(
      {},
      "",
      "/?note=index.md&azurite-dev=sentry-test",
    );
    render(<AzuriteRouterProvider />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Replace note" }),
    );
    await waitFor(() => {
      expect(window.location.search).toContain("azurite-dev=sentry-test");
      expect(window.location.search).toContain("note=Daily%2Ftoday.md");
    });
  });
});
