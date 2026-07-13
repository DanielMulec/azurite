import { vi } from "vitest";

import type { RouteStoreExecutor } from "../src/routing/route-store-executor.js";

/** Creates an observable store executor with safe terminal defaults. */
export function createTestRouteExecutor(
  patch: Partial<RouteStoreExecutor> = {},
): {
  readonly applyRoute: ReturnType<
    typeof vi.fn<RouteStoreExecutor["applyRoute"]>
  >;
  readonly ensureNotes: ReturnType<
    typeof vi.fn<RouteStoreExecutor["ensureNotes"]>
  >;
  readonly executor: RouteStoreExecutor;
  readonly getCoherentView: ReturnType<
    typeof vi.fn<RouteStoreExecutor["getCoherentView"]>
  >;
  readonly reportHistoryUnavailable: ReturnType<
    typeof vi.fn<RouteStoreExecutor["reportHistoryUnavailable"]>
  >;
} {
  const applyRoute = vi.fn<RouteStoreExecutor["applyRoute"]>((input) =>
    Promise.resolve(
      input.noteId === undefined
        ? { requestSequence: undefined, status: "applied", view: "empty" }
        : { requestSequence: 1, status: "applied", view: "ready" },
    ),
  );
  const ensureNotes = vi.fn<RouteStoreExecutor["ensureNotes"]>(() =>
    Promise.resolve({ noteIds: ["a.md", "b.md", "c.md"], status: "ready" }),
  );
  const getCoherentView = vi.fn<RouteStoreExecutor["getCoherentView"]>();
  const reportHistoryUnavailable =
    vi.fn<RouteStoreExecutor["reportHistoryUnavailable"]>();
  return {
    applyRoute,
    ensureNotes,
    executor: {
      activateRouteIntent: vi.fn(),
      applyRoute,
      ensureNotes,
      getCoherentView,
      getRenderedOwnerKey: () => "rendered-a-session",
      reportHistoryUnavailable,
      ...patch,
    },
    getCoherentView,
    reportHistoryUnavailable,
  };
}
