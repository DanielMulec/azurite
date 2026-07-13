import type { RouteTransitionGate } from "../routing/route-transition-types.js";
import type { NoteBrowserStore } from "./note-browser-contracts.js";

/** Preserves today's best-effort draft flush at the Slice 7C gate seam. */
export function createBaselineRouteDraftGate(
  store: StoreApi<NoteBrowserStore>,
): RouteTransitionGate {
  return {
    prepare: async () => {
      try {
        await store.getState().flushPendingDraft();
      } catch {
        recordThrownDraftFlush(store);
      }
      return { status: "continue" };
    },
    settle: () => {},
  };
}

function recordThrownDraftFlush(store: StoreApi<NoteBrowserStore>): void {
  try {
    store.setState({
      draftRecoveryStatus: {
        message: "Draft recovery is degraded. Manual save still works.",
        reason: "write_failed",
        status: "degraded",
      },
    });
  } catch {
    // Production navigation remains fail-open even when a subscriber throws.
  }
}
import type { StoreApi } from "zustand/vanilla";
