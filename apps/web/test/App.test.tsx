// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiErrorCodes } from "@azurite/shared";
import { AzuriteRouterProvider } from "../src/app-router.js";

vi.mock("../src/components/MilkdownEditor.js", () => ({
  MilkdownEditor: ({
    initialMarkdown,
    onMarkdownChange,
    noteId,
    title,
  }: {
    readonly initialMarkdown: string;
    readonly noteId: string;
    readonly onMarkdownChange?: (markdown: string) => void;
    readonly title: string;
  }) => (
    <div data-testid="milkdown-editor" data-note-id={noteId}>
      <p>Mock editor for {title}</p>
      <pre>{initialMarkdown}</pre>
      <button
        onClick={() => {
          onMarkdownChange?.(`${initialMarkdown}\nDraft edit`);
        }}
        type="button"
      >
        Mock edit
      </button>
    </div>
  ),
}));

const readyClusterIdentity = {
  clusterId: "019f42cc-eb37-7849-ac5a-e0209d409678",
  status: "ready",
} as const;
const homeSummary = {
  fileName: "index.md",
  id: "index.md",
  lastModifiedAt: "2026-07-07T12:00:00.000Z",
  relativePath: "index.md",
  sizeBytes: 42,
  title: "Home",
};
const projectSummary = {
  fileName: "azurite.md",
  id: "Projects/azurite.md",
  lastModifiedAt: "2026-07-07T12:01:00.000Z",
  relativePath: "Projects/azurite.md",
  sizeBytes: 84,
  title: "Project Plan",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App primary note flow", () => {
  it("loads notes, auto-selects the first note, and mounts the editor", async () => {
    stubWorkspaceResponses();

    renderApp();

    const homeButton = await screen.findByRole("button", { name: /Home/ });
    await waitFor(() => {
      expect(homeButton).toHaveAttribute("aria-current", "page");
    });
    expect(await screen.findByTestId("milkdown-editor")).toHaveAttribute(
      "data-note-id",
      "index.md",
    );
    expect(await screen.findByText("Mock editor for Home")).toBeInTheDocument();
    expect(window.location.search).toContain("note=index.md");
  });

  it("renders the selected note after a user selects another note", async () => {
    stubWorkspaceResponses();

    renderApp();

    const projectButton = await screen.findByRole("button", {
      name: /Project Plan/,
    });
    fireEvent.click(projectButton);

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Project Plan",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("milkdown-editor")).toHaveAttribute(
      "data-note-id",
      "Projects/azurite.md",
    );
    expect(window.location.search).toContain("note=Projects%2Fazurite.md");
  });

  it("restores the selected note from route state on reload", async () => {
    stubWorkspaceResponses();

    renderApp("Projects/azurite.md");

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Project Plan",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("milkdown-editor")).toHaveAttribute(
      "data-note-id",
      "Projects/azurite.md",
    );
    expect(window.location.search).toContain("note=Projects%2Fazurite.md");
  });
});

describe("App note switching", () => {
  it("keeps the current note visible while the next note loads", async () => {
    const deferredProjectResponse = createDeferredResponse();
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary, projectSummary],
        },
        status: 200,
      },
      "/api/notes/content?noteId=Projects%2Fazurite.md":
        deferredProjectResponse.promise,
      "/api/notes/content?noteId=index.md": {
        body: {
          note: {
            ...homeSummary,
            contentHash: "sha256-home",
            markdown: "# Home\n\nWelcome to Azurite.",
          },
          clusterIdentity: readyClusterIdentity,
        },
        status: 200,
      },
    });

    renderApp();

    expect(await screen.findByText("Mock editor for Home")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: /Project Plan/ }),
    );

    expect(screen.queryByText("Loading note")).not.toBeInTheDocument();
    expect(screen.getByText("Mock editor for Home")).toBeInTheDocument();
    deferredProjectResponse.resolve({
      body: {
        clusterIdentity: readyClusterIdentity,
        note: {
          ...projectSummary,
          contentHash: "sha256-project",
          markdown: "# Project Plan\n\nSlice notes.",
        },
      },
      status: 200,
    });
    await waitFor(() => {
      expect(
        screen.getByText("Mock editor for Project Plan"),
      ).toBeInTheDocument();
    });
  });
});

describe("App workspace states", () => {
  it("shows the empty workspace state", async () => {
    stubJsonFetch({
      "/api/notes": {
        body: { clusterIdentity: readyClusterIdentity, notes: [] },
        status: 200,
      },
    });

    renderApp();

    await waitFor(() => {
      expect(
        screen.getByText("No markdown notes found in this cluster."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Choose a note from the cluster list."),
      ).toBeInTheDocument();
    });
  });

  it("shows safe API errors without absolute paths", async () => {
    stubJsonFetch({
      "/api/notes": {
        body: {
          error: {
            code: apiErrorCodes.invalidWorkspace,
            message: "Configured workspace path is not a readable directory.",
          },
        },
        status: 500,
      },
    });

    renderApp();

    expect(
      await screen.findByText(
        "Configured workspace path is not a readable directory.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("/Users/daniel");
  });

  it("shows a missing-note state when the URL note no longer exists", async () => {
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary],
        },
        status: 200,
      },
    });

    renderApp("deleted.md");

    expect(await screen.findByText("Note not found")).toBeInTheDocument();
    expect(
      screen.getByText("The selected note no longer exists on disk."),
    ).toBeInTheDocument();
  });
});

function stubWorkspaceResponses(): void {
  stubJsonFetch({
    "/api/notes": {
      body: {
        clusterIdentity: readyClusterIdentity,
        notes: [homeSummary, projectSummary],
      },
      status: 200,
    },
    "/api/notes/content?noteId=Projects%2Fazurite.md": {
      body: {
        note: {
          ...projectSummary,
          contentHash: "sha256-project",
          markdown: "# Project Plan\n\nSlice notes.",
        },
        clusterIdentity: readyClusterIdentity,
      },
      status: 200,
    },
    "/api/notes/content?noteId=index.md": {
      body: {
        note: {
          ...homeSummary,
          contentHash: "sha256-home",
          markdown: "# Home\n\nWelcome to Azurite.",
        },
        clusterIdentity: readyClusterIdentity,
      },
      status: 200,
    },
  });
}

function renderApp(routeNoteId?: string): void {
  const search =
    routeNoteId === undefined ? "" : `?note=${encodeURIComponent(routeNoteId)}`;
  window.history.replaceState({}, "", `/${search}`);
  render(<AzuriteRouterProvider />);
}

function stubJsonFetch(
  routes: Record<string, StubRoute | Promise<StubRoute>>,
): void {
  const fetchMock = vi.fn<typeof fetch>((input) =>
    Promise.resolve(createRouteResponse(input, routes)),
  );
  vi.stubGlobal("fetch", fetchMock);
}

async function createRouteResponse(
  input: RequestInfo | URL,
  routes: Record<string, StubRoute | Promise<StubRoute>>,
): Promise<Response> {
  const route = await routes[toRouteKey(input)];

  if (route === undefined) {
    return createJsonResponse({ error: "Unexpected route." }, 404);
  }

  return createJsonResponse(route.body, route.status);
}

function createJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function toRouteKey(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return `${input.pathname}${input.search}`;
  }

  const requestUrl = new URL(input.url);
  return `${requestUrl.pathname}${requestUrl.search}`;
}

type StubRoute = {
  readonly body: unknown;
  readonly status: number;
};

function createDeferredResponse(): {
  readonly promise: Promise<StubRoute>;
  readonly resolve: (route: StubRoute) => void;
} {
  let resolveDeferred: (route: StubRoute) => void = () => {};
  const promise = new Promise<StubRoute>((resolve) => {
    resolveDeferred = resolve;
  });

  return {
    promise,
    resolve: resolveDeferred,
  };
}
