import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";

import { App } from "./App.js";

type AppSearch = {
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
  if (typeof search.note !== "string") {
    return {};
  }

  return { note: search.note };
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
  const replaceSelectedNote = useCallback(
    (noteId: string) => {
      void navigate({ replace: true, search: { note: noteId }, to: "/" });
    },
    [navigate],
  );
  const pushSelectedNote = useCallback(
    (noteId: string) => {
      void navigate({ search: { note: noteId }, to: "/" });
    },
    [navigate],
  );
  const navigation = useMemo(
    () => ({ pushSelectedNote, replaceSelectedNote }),
    [pushSelectedNote, replaceSelectedNote],
  );

  return <App navigation={navigation} routeNoteId={search.note} />;
}
