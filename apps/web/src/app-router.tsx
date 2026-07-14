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
  useSyncExternalStore,
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
import type { NoteBrowserRouteGateFactory } from "./use-note-browser.js";

export {
  parseAppLocationSearch,
  parseAppSearch,
} from "./routing/app-route-search.js";
export type { AppSearch } from "./routing/app-route-search.js";

const rootRoute = createRootRoute();
const routeOwnerContext = createContext<RouteTransitionOwner | undefined>(
  undefined,
);
const routeGateFactoryContext = createContext<
  NoteBrowserRouteGateFactory | undefined
>(undefined);

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
  readonly dispose: () => void;
  readonly owner: RouteTransitionOwner;
  readonly router: AzuriteRouter;
};

type RouterRuntimePublication = {
  readonly current: () => AzuriteRouterRuntime | undefined;
  readonly publish: (runtime: AzuriteRouterRuntime) => void;
  readonly retire: (runtime: AzuriteRouterRuntime) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

type AzuriteRouterProviderProps = {
  readonly createRouteGate?: NoteBrowserRouteGateFactory | undefined;
  readonly runtimeOptions?: AzuriteRouterRuntimeOptions | undefined;
};

/** Optional acceptance-only controls for the production router runtime. */
export type AzuriteRouterRuntimeOptions = {
  readonly confirmRestoration?: Parameters<
    typeof createRouteTransitionOwner
  >[0]["confirmRestoration"];
};

/** React provider for Azurite's typed client router and transition owner. */
export function AzuriteRouterProvider({
  createRouteGate,
  runtimeOptions,
}: AzuriteRouterProviderProps = {}): ReactElement | null {
  const [publication] = useState(createRouterRuntimePublication);
  const runtime = useSyncExternalStore(
    publication.subscribe,
    publication.current,
    publication.current,
  );
  const confirmRestoration = runtimeOptions?.confirmRestoration;
  useEffect(() => {
    const nextRuntime = createAzuriteRouterRuntime({
      ...(confirmRestoration === undefined ? {} : { confirmRestoration }),
    });
    publication.publish(nextRuntime);
    return () => {
      publication.retire(nextRuntime);
      nextRuntime.dispose();
    };
  }, [confirmRestoration, publication]);

  if (runtime === undefined) {
    return null;
  }

  return (
    <routeGateFactoryContext.Provider value={createRouteGate}>
      <routeOwnerContext.Provider value={runtime.owner}>
        <RouterProvider router={runtime.router} />
      </routeOwnerContext.Provider>
    </routeGateFactoryContext.Provider>
  );
}

/** Creates one disposable production router generation after React commits. */
export function createAzuriteRouterRuntime(
  options: AzuriteRouterRuntimeOptions = {},
): AzuriteRouterRuntime {
  const history = createBrowserHistory();
  const router = createAzuriteRouter(history);
  const owner = createRouteTransitionOwner({
    ...getRestorationOptions(options),
    history,
    router: createRouterAdapter(router),
  });
  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      owner.dispose();
      history.destroy();
    },
    owner,
    router,
  };
}

function createRouterRuntimePublication(): RouterRuntimePublication {
  let current: AzuriteRouterRuntime | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    current: () => current,
    publish: (runtime) => {
      current = runtime;
      notify();
    },
    retire: (runtime) => {
      if (current !== runtime) {
        return;
      }
      current = undefined;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function getRestorationOptions(options: AzuriteRouterRuntimeOptions) {
  return options.confirmRestoration === undefined
    ? {}
    : { confirmRestoration: options.confirmRestoration };
}

function AppRoute(): ReactElement {
  const search = getCurrentSearch(appRoute.useSearch());
  return (
    <App
      createRouteGate={useContext(routeGateFactoryContext)}
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
