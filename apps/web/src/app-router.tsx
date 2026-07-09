import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { noteIdSchema } from "@azurite/shared";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";

import { App } from "./App.js";

/** Typed URL search state owned by Azurite's root route. */
export type AppSearch = {
  readonly "azurite-dev"?: "sentry-test";
  readonly note?: string;
};

const rootRoute = createRootRoute();

/** Root route that owns Azurite's selected-note URL search state. */
export const appRoute = createRoute({
  component: AppRoute,
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: parseAppSearch,
});

const routeTree = rootRoute.addChildren([appRoute]);

/** Creates one TanStack Router instance for the Azurite web shell. */
export function createAzuriteRouter() {
  return createRouter({ routeTree });
}

/** Parses the URL-owned note selection search state. */
export function parseAppSearch(search: Record<string, unknown>): AppSearch {
  const parsedNote =
    typeof search.note === "string" ? parseSafeRouteNote(search.note) : {};

  if (search["azurite-dev"] === "sentry-test") {
    return { ...parsedNote, "azurite-dev": "sentry-test" };
  }

  return parsedNote;
}

/** Parses browser URL search text through one URL-decoding boundary. */
export function parseAppLocationSearch(locationSearch: string): AppSearch {
  return parseAppSearch({
    "azurite-dev":
      new URLSearchParams(locationSearch).get("azurite-dev") ?? undefined,
    note: new URLSearchParams(locationSearch).get("note") ?? undefined,
  });
}

function parseSafeRouteNote(note: string): AppSearch {
  const parsedNote = noteIdSchema.safeParse(note);

  return parsedNote.success ? { note: parsedNote.data } : {};
}

type AzuriteRouter = ReturnType<typeof createAzuriteRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AzuriteRouter;
  }
}

/** React provider for Azurite's typed client router. */
export function AzuriteRouterProvider(): ReactElement {
  const [router] = useState(createAzuriteRouter);

  return <RouterProvider router={router} />;
}

function AppRoute(): ReactElement {
  const search = appRoute.useSearch();
  const navigate = appRoute.useNavigate();
  const currentSearch = getCurrentSearch(search);
  const routeNoteId = currentSearch.note;
  const replaceSelectedNote = useCallback(
    (noteId: string) => {
      void navigate({
        replace: true,
        search: createNoteNavigationSearch(search, noteId),
        to: "/",
      });
    },
    [navigate, search],
  );
  const pushSelectedNote = useCallback(
    (noteId: string) => {
      void navigate({
        search: createNoteNavigationSearch(search, noteId),
        to: "/",
      });
    },
    [navigate, search],
  );
  const navigation = useMemo(
    () => ({ pushSelectedNote, replaceSelectedNote }),
    [pushSelectedNote, replaceSelectedNote],
  );

  return (
    <App
      devDiagnostics={currentSearch["azurite-dev"]}
      navigation={navigation}
      routeNoteId={routeNoteId}
    />
  );
}

function getCurrentSearch(search: AppSearch): AppSearch {
  if (typeof window === "undefined") {
    return parseAppSearch(search);
  }

  return parseAppLocationSearch(window.location.search);
}

function createNoteNavigationSearch(
  search: AppSearch,
  noteId: string,
): AppSearch {
  if (search["azurite-dev"] === "sentry-test") {
    return { "azurite-dev": "sentry-test", note: noteId };
  }

  return { note: noteId };
}
