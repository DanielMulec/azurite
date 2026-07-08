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

import { App } from "../src/App.js";
import { AzuriteRouterProvider } from "../src/app-router.js";

vi.mock("../src/components/MilkdownEditor.js", () => ({
  MilkdownEditor: ({
    initialMarkdown,
    noteId,
    title,
  }: {
    readonly initialMarkdown: string;
    readonly noteId: string;
    readonly title: string;
  }) => (
    <div data-testid="milkdown-editor" data-note-id={noteId}>
      <p>Mock editor for {title}</p>
      <pre>{initialMarkdown}</pre>
    </div>
  ),
}));

const readyClusterIdentity = {
  clusterId: "019f42cc-eb37-7849-ac5a-e0209d409678",
  status: "ready",
} as const;
const homeSummary = createSummary("index.md", "Home");
const projectSummary = createSummary("Projects/azurite.md", "Project Plan");
const dailySummary = createSummary("Daily/today.md", "Daily Note");

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("App routing hardening", () => {
  it("does not push a stale URL after rapid note selection", async () => {
    const deferredProject = createDeferredResponse();
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary, projectSummary, dailySummary],
        },
        status: 200,
      },
      "/api/notes/content?noteId=Daily%2Ftoday.md": noteRoute(
        dailySummary,
        "# Daily",
        "sha256-daily",
      ),
      "/api/notes/content?noteId=Projects%2Fazurite.md":
        deferredProject.promise,
      "/api/notes/content?noteId=index.md": noteRoute(
        homeSummary,
        "# Home",
        "sha256-home",
      ),
    });
    const navigation = renderApp();

    expect(await screen.findByText("Mock editor for Home")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: /Project Plan/ }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Daily Note/ }));
    expect(
      await screen.findByText("Mock editor for Daily Note"),
    ).toBeInTheDocument();
    deferredProject.resolve(
      noteRoute(projectSummary, "# Project", "sha256-project"),
    );
    await waitFor(() => {
      expect(
        screen.getByText("Mock editor for Daily Note"),
      ).toBeInTheDocument();
    });

    expect(navigation.pushSelectedNote).toHaveBeenCalledWith("Daily/today.md");
    expect(navigation.pushSelectedNote).not.toHaveBeenCalledWith(
      "Projects/azurite.md",
    );
  });

  it("updates the selected note when browser history moves backward", async () => {
    window.history.replaceState({}, "", "/?note=index.md");
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary, projectSummary],
        },
        status: 200,
      },
      "/api/notes/content?noteId=Projects%2Fazurite.md": noteRoute(
        projectSummary,
        "# Project",
        "sha256-project",
      ),
      "/api/notes/content?noteId=index.md": noteRoute(
        homeSummary,
        "# Home",
        "sha256-home",
      ),
    });

    render(<AzuriteRouterProvider />);

    expect(await screen.findByText("Mock editor for Home")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: /Project Plan/ }),
    );
    await waitFor(() => {
      expect(window.location.search).toContain("note=Projects%2Fazurite.md");
    });
    expect(
      await screen.findByText("Mock editor for Project Plan"),
    ).toBeInTheDocument();
    window.history.back();
    await waitFor(() => {
      expect(screen.getByText("Mock editor for Home")).toBeInTheDocument();
    });
  });
});

function renderApp(routeNoteId?: string) {
  const navigation = {
    pushSelectedNote: vi.fn(),
    replaceSelectedNote: vi.fn(),
  };

  render(<App navigation={navigation} routeNoteId={routeNoteId} />);

  return navigation;
}

function createSummary(id: string, title: string) {
  return {
    fileName: id.split("/").at(-1) ?? id,
    id,
    lastModifiedAt: "2026-07-07T12:00:00.000Z",
    relativePath: id,
    sizeBytes: title.length,
    title,
  };
}

function noteRoute(
  summary: ReturnType<typeof createSummary>,
  markdown: string,
  contentHash: string,
): StubRoute {
  return {
    body: {
      clusterIdentity: readyClusterIdentity,
      note: {
        ...summary,
        contentHash,
        markdown,
      },
    },
    status: 200,
  };
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
