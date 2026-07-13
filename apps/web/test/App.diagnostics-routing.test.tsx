// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AzuriteRouterProvider } from "../src/app-router.js";
import type { RouteStoreExecutor } from "../src/routing/route-store-executor.js";
import type { RouteTransitionOwner } from "../src/routing/route-transition-owner.js";

vi.mock("../src/App.js", () => ({
  App: ({
    devDiagnostics,
    transitionOwner,
  }: {
    readonly devDiagnostics?: "sentry-test";
    readonly transitionOwner: RouteTransitionOwner;
  }) => {
    useEffect(
      () => transitionOwner.registerStoreExecutor(createProbeExecutor()),
      [transitionOwner],
    );
    return (
      <main>
        <p data-testid="route-note">
          {new URLSearchParams(window.location.search).get("note")}
        </p>
        <p data-testid="dev-diagnostics">{devDiagnostics}</p>
        <button
          onClick={() => {
            void transitionOwner.selectNote("Projects/azurite.md");
          }}
          type="button"
        >
          Push note
        </button>
      </main>
    );
  },
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
    window.history.replaceState({}, "", "/?azurite-dev=sentry-test");
    render(<AzuriteRouterProvider />);

    await waitFor(() => {
      expect(window.location.search).toContain("azurite-dev=sentry-test");
      expect(window.location.search).toContain("note=Daily%2Ftoday.md");
    });
  });
});

function createProbeExecutor(): RouteStoreExecutor {
  return {
    activateRouteIntent: () => {},
    applyRoute: (input) =>
      Promise.resolve(
        input.noteId === undefined
          ? {
              requestSequence: undefined,
              status: "applied",
              view: "empty",
            }
          : {
              requestSequence: 1,
              status: "applied",
              view: "missing",
            },
      ),
    ensureNotes: () =>
      Promise.resolve({
        noteIds: ["Daily/today.md", "index.md", "Projects/azurite.md"],
        status: "ready",
      }),
    getCoherentView: () => undefined,
    getRenderedOwnerKey: () => undefined,
    reportHistoryUnavailable: () => {},
  };
}
