import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  type HistoryLocation,
  type RouterHistory,
} from "@tanstack/react-router";
import {
  createContext,
  type ReactElement,
  useContext,
  useEffect,
  useState,
} from "react";

import { App } from "./App.js";
import {
  parseAppLocationSearch,
  parseAppSearch,
  type AppSearch,
} from "./routing/app-route-search.js";
import {
  createRouteTransitionOwner,
  type RouteTransitionOwner,
} from "./routing/route-transition-owner.js";
import { applicationNavigationTokenStateKey } from "./routing/validated-route-location.js";

export {
  parseAppLocationSearch,
  parseAppSearch,
} from "./routing/app-route-search.js";
export type { AppSearch } from "./routing/app-route-search.js";

const rootRoute = createRootRoute();
const routeOwnerContext = createContext<RouteTransitionOwner | undefined>(
  undefined,
);

/** Root route that owns Azurite's selected-note URL search state. */
export const appRoute = createRoute({
  component: AppRoute,
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: parseAppSearch,
});

const routeTree = rootRoute.addChildren([appRoute]);

/** Creates one TanStack Router instance for the Azurite web shell. */
export function createAzuriteRouter(history?: RouterHistory) {
  return createRouter({
    ...(history === undefined ? {} : { history }),
    routeTree,
  });
}

type AzuriteRouter = ReturnType<typeof createAzuriteRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AzuriteRouter;
  }
}

type AzuriteRouterRuntime = {
  readonly owner: RouteTransitionOwner;
  readonly router: AzuriteRouter;
};

/** React provider for Azurite's typed client router and transition owner. */
export function AzuriteRouterProvider(): ReactElement {
  const [runtime] = useState(createAzuriteRouterRuntime);
  useEffect(
    () => () => {
      runtime.owner.dispose();
    },
    [runtime],
  );

  return (
    <routeOwnerContext.Provider value={runtime.owner}>
      <RouterProvider router={runtime.router} />
    </routeOwnerContext.Provider>
  );
}

/** Creates the production router and owner before RouterProvider renders. */
export function createAzuriteRouterRuntime(): AzuriteRouterRuntime {
  const history = createBrowserHistory();
  const router = createAzuriteRouter(history);
  const owner = createRouteTransitionOwner({
    history,
    router: createRouterAdapter(router),
  });
  return { owner, router };
}

function AppRoute(): ReactElement {
  const search = getCurrentSearch(appRoute.useSearch());
  return (
    <App
      devDiagnostics={search["azurite-dev"]}
      transitionOwner={useRouteTransitionOwner()}
    />
  );
}

function useRouteTransitionOwner(): RouteTransitionOwner {
  const owner = useContext(routeOwnerContext);
  if (owner === undefined) {
    throw new Error("Azurite route-transition owner is unavailable.");
  }
  return owner;
}

function createRouterAdapter(
  router: AzuriteRouter,
): Parameters<typeof createRouteTransitionOwner>[0]["router"] {
  return {
    historyLocation: () => router.history.location,
    navigate: async (input) => {
      await router.navigate({
        href: input.href,
        replace: input.replace,
        state: (previous) => ({
          ...previous,
          [applicationNavigationTokenStateKey]: input.token,
        }),
      });
    },
    subscribeHistory: (listener) =>
      router.history.subscribe(({ location }) => {
        listener(location);
      }),
    subscribeResolved: (listener) =>
      router.subscribe("onResolved", ({ toLocation }) => {
        listener(toHistoryLocation(toLocation));
      }),
  };
}

function toHistoryLocation(
  location: Parameters<
    Parameters<AzuriteRouter["subscribe"]>[1]
  >[0]["toLocation"],
): HistoryLocation {
  return {
    hash: location.hash,
    href: location.href,
    pathname: location.pathname,
    search: location.searchStr,
    state: location.state,
  };
}

function getCurrentSearch(search: AppSearch): AppSearch {
  return typeof window === "undefined"
    ? parseAppSearch(search)
    : parseAppLocationSearch(window.location.search);
}
