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

import { AzuriteRouterProvider } from "../src/app-router.js";

vi.mock("../src/components/MilkdownEditor.js", async () => {
  const { useEffect } = await import("react");
  return {
    MilkdownEditor: (props: {
      readonly initialMarkdown: string;
      readonly noteId: string;
      readonly sessionGate: {
        readonly registerController: (controller: {
          readonly commit: (cause: string) => unknown;
          readonly sessionKey: string;
          readonly setFrozen: (frozen: boolean) => void;
        }) => () => void;
      };
      readonly sessionKey: string;
      readonly title: string;
    }) => {
      useEffect(
        () =>
          props.sessionGate.registerController({
            commit: (cause) => ({
              cause,
              reason: "source_authority_current",
              revision: 0,
              sessionKey: props.sessionKey,
              status: "no_change",
            }),
            sessionKey: props.sessionKey,
            setFrozen: () => {},
          }),
        [props.sessionGate, props.sessionKey],
      );
      return (
        <div data-testid="milkdown-editor" data-note-id={props.noteId}>
          <p>Mock editor for {props.title}</p>
          <pre>{props.initialMarkdown}</pre>
        </div>
      );
    },
  };
});

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

describe("App rapid note selection routing", () => {
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
    renderApp();

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

    expect(window.location.search).toContain("note=Daily%2Ftoday.md");
  });
});

describe("App browser history routing", () => {
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

describe("App invalid route startup", () => {
  it("canonicalizes an unsafe note without issuing any note read", async () => {
    window.history.replaceState({}, "", "/?note=..%2Fsecret.md");
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary, projectSummary],
        },
        status: 200,
      },
    });

    render(<AzuriteRouterProvider />);

    expect(
      await screen.findByText("Choose a note from the cluster list."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
    expect(toRouteKey(vi.mocked(fetch).mock.calls[0]?.[0] ?? "")).toBe(
      "/api/notes",
    );
  });
});

describe("App percent route startup", () => {
  it("loads a note with a literal percent character from encoded URL search", async () => {
    const percentSummary = createSummary("100%.md", "Percent Note");
    window.history.replaceState({}, "", "/?note=100%25.md");
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary, percentSummary],
        },
        status: 200,
      },
      "/api/notes/content?noteId=100%25.md": noteRoute(
        percentSummary,
        "# Percent",
        "sha256-percent",
      ),
    });

    render(<AzuriteRouterProvider />);

    expect(
      await screen.findByText("Mock editor for Percent Note"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveAttribute(
      "data-note-id",
      "100%.md",
    );
  });

  it("does not turn a literal encoded-looking filename into a path", async () => {
    const encodedNameSummary = createSummary("foo%2Fbar.md", "Encoded Name");
    window.history.replaceState({}, "", "/?note=foo%252Fbar.md");
    stubJsonFetch({
      "/api/notes": {
        body: {
          clusterIdentity: readyClusterIdentity,
          notes: [homeSummary, encodedNameSummary],
        },
        status: 200,
      },
      "/api/notes/content?noteId=foo%252Fbar.md": noteRoute(
        encodedNameSummary,
        "# Encoded",
        "sha256-encoded",
      ),
    });

    render(<AzuriteRouterProvider />);

    expect(
      await screen.findByText("Mock editor for Encoded Name"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-editor")).toHaveAttribute(
      "data-note-id",
      "foo%2Fbar.md",
    );
  });
});

function renderApp(routeNoteId?: string): void {
  const search =
    routeNoteId === undefined ? "" : `?note=${encodeURIComponent(routeNoteId)}`;
  window.history.replaceState({}, "", `/${search}`);
  render(<AzuriteRouterProvider />);
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
