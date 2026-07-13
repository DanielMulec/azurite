import type {
  NoteLoadAuthorization,
  RouteGateCause,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";

/** Stable notes-list readiness result consumed by the transition owner. */
export type RouteNotesResult =
  | { readonly noteIds: readonly string[]; readonly status: "ready" }
  | { readonly status: "failed" };

/** Input authorizing one current route intent to enter Zustand. */
export type RouteStoreApplyInput = {
  readonly authorization: Extract<
    NoteLoadAuthorization,
    { readonly kind: "route_intent" }
  >;
  readonly cause: RouteGateCause;
  readonly location: ValidatedLocationOccurrence;
  readonly noteId: string | undefined;
};

/** Store-owned terminal surface result returned to the route owner. */
export type RouteStoreApplyResult =
  | {
      readonly requestSequence: number;
      readonly status: "applied";
      readonly view: "missing" | "missing_draft" | "ready";
    }
  | {
      readonly requestSequence: undefined;
      readonly status: "applied";
      readonly view: "empty";
    }
  | {
      readonly status: "coherent_noop";
      readonly view: "empty" | "error" | "missing" | "missing_draft" | "ready";
    }
  | { readonly status: "stale" }
  | { readonly reason: "note_read_failed"; readonly status: "failed" }
  | { readonly reason: "store_apply_failed"; readonly status: "failed" };

/** Zustand adapter captured by admitted route transitions. */
export type RouteStoreExecutor = {
  readonly activateRouteIntent: (intentKey: string) => void;
  readonly applyRoute: (
    input: RouteStoreApplyInput,
  ) => Promise<RouteStoreApplyResult>;
  readonly ensureNotes: () => Promise<RouteNotesResult>;
  readonly getCoherentView: (
    occurrence: ValidatedLocationOccurrence,
    noteId: string | undefined,
  ) => RouteStoreApplyResult | undefined;
  readonly getRenderedOwnerKey: () => string | undefined;
  readonly reportHistoryUnavailable: () => void;
};

/** Identity-safe executor slot that queues intents until React registers. */
export type RouteStoreExecutorRegistry = {
  readonly dispose: () => void;
  readonly get: () => RouteStoreExecutor | undefined;
  readonly register: (executor: RouteStoreExecutor) => () => void;
  readonly wait: () => Promise<RouteStoreExecutor | undefined>;
};

/** Creates the replaceable store-executor slot for one route owner. */
export function createRouteStoreExecutorRegistry(): RouteStoreExecutorRegistry {
  let current: RouteStoreExecutor | undefined;
  let disposed = false;
  const waiting = new Set<(executor: RouteStoreExecutor | undefined) => void>();

  return {
    dispose: () => {
      disposed = true;
      current = undefined;
      resolveWaiting(undefined, waiting);
    },
    get: () => current,
    register: (executor) => {
      if (disposed) {
        return () => {};
      }
      current = executor;
      resolveWaiting(executor, waiting);
      return () => {
        if (current === executor) {
          current = undefined;
        }
      };
    },
    wait: async () => {
      if (disposed || current !== undefined) {
        return current;
      }
      return await new Promise<RouteStoreExecutor | undefined>((resolve) => {
        waiting.add(resolve);
      });
    },
  };
}

function resolveWaiting(
  executor: RouteStoreExecutor | undefined,
  waiting: Set<(executor: RouteStoreExecutor | undefined) => void>,
): void {
  for (const resolve of waiting) {
    resolve(executor);
  }
  waiting.clear();
}
