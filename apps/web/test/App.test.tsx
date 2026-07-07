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

import { apiErrorCodes } from "@azurite/shared";
import { App } from "../src/App.js";

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

    render(<App />);

    const homeButton = await screen.findByRole("button", { name: /Home/ });
    expect(homeButton).toHaveAttribute("aria-current", "page");
    expect(await screen.findByTestId("milkdown-editor")).toHaveAttribute(
      "data-note-id",
      "index.md",
    );
    expect(await screen.findByText("Mock editor for Home")).toBeInTheDocument();
  });

  it("renders the selected note after a user selects another note", async () => {
    stubWorkspaceResponses();

    render(<App />);

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
  });
});

describe("App note switching", () => {
  it("keeps the current note visible while the next note loads", async () => {
    const deferredProjectResponse = createDeferredResponse();
    stubJsonFetch({
      "/api/notes": {
        body: { notes: [homeSummary, projectSummary] },
        status: 200,
      },
      "/api/notes/content?noteId=Projects%2Fazurite.md":
        deferredProjectResponse.promise,
      "/api/notes/content?noteId=index.md": {
        body: {
          note: {
            ...homeSummary,
            markdown: "# Home\n\nWelcome to Azurite.",
          },
        },
        status: 200,
      },
    });

    render(<App />);

    expect(await screen.findByText("Mock editor for Home")).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: /Project Plan/ }),
    );

    expect(screen.queryByText("Loading note")).not.toBeInTheDocument();
    expect(screen.getByText("Mock editor for Home")).toBeInTheDocument();
    deferredProjectResponse.resolve({
      body: {
        note: {
          ...projectSummary,
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
    stubJsonFetch({ "/api/notes": { body: { notes: [] }, status: 200 } });

    render(<App />);

    expect(
      await screen.findByText("No markdown notes found in this cluster."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Choose a note from the cluster list."),
    ).toBeInTheDocument();
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

    render(<App />);

    expect(
      await screen.findByText(
        "Configured workspace path is not a readable directory.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("/Users/daniel");
  });
});

function stubWorkspaceResponses(): void {
  stubJsonFetch({
    "/api/notes": {
      body: { notes: [homeSummary, projectSummary] },
      status: 200,
    },
    "/api/notes/content?noteId=Projects%2Fazurite.md": {
      body: {
        note: {
          ...projectSummary,
          markdown: "# Project Plan\n\nSlice notes.",
        },
      },
      status: 200,
    },
    "/api/notes/content?noteId=index.md": {
      body: {
        note: {
          ...homeSummary,
          markdown: "# Home\n\nWelcome to Azurite.",
        },
      },
      status: 200,
    },
  });
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
