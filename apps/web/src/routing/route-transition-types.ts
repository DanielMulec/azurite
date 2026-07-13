import type { AppSearch } from "./app-route-search.js";

/** User-visible origin of a route transition. */
export type RouteGateCause = "note_list" | "startup_fallback" | "url_sync";

/** Browser-history action that introduced one candidate occurrence. */
export type RouteNavigationKind =
  | "initial"
  | "application_push"
  | "startup_replace"
  | "history_back"
  | "history_forward"
  | "history_go"
  | "canonical_replace";

/** Immutable validated identity for one browser-history occurrence. */
export type ValidatedLocationOccurrence = {
  readonly generation: number;
  readonly hash: string;
  readonly historyIndex: number;
  readonly historyKey: string;
  readonly href: string;
  readonly pathname: string;
  readonly search: AppSearch;
};

/** Last coherent route location and rendered product view. */
export type CommittedRouteView =
  | {
      readonly location: ValidatedLocationOccurrence;
      readonly noteId: string;
      readonly renderedOwnerKey: string;
      readonly view: "missing_draft" | "ready";
    }
  | {
      readonly location: ValidatedLocationOccurrence;
      readonly noteId: string;
      readonly renderedOwnerKey: undefined;
      readonly view: "error" | "missing";
    }
  | {
      readonly location: ValidatedLocationOccurrence;
      readonly noteId: undefined;
      readonly renderedOwnerKey: undefined;
      readonly view: "empty";
    };

/** Exact authority for one route-driven or explicit note read. */
export type NoteLoadAuthorization =
  | {
      readonly authorizationKey: string;
      readonly intentKey: string;
      readonly kind: "route_intent";
    }
  | {
      readonly authorizationKey: string;
      readonly kind: "explicit_reload";
      readonly source: "draft_discard_reload";
    };

/** Target-free input allocated by the route owner for one gate caller. */
export type RouteGatePrepareInput = {
  readonly cause: RouteGateCause;
  readonly leaseKey: string;
  readonly outgoingOwnerKey: string | undefined;
};

/** Gate decision that either admits or cancels the current transition. */
export type RouteGateResult =
  | { readonly status: "continue" }
  | {
      readonly reason:
        | "outgoing_owner_lost"
        | "prerequisite_failed"
        | "prerequisite_unavailable";
      readonly status: "cancel";
    };

/** Exact terminal result returned for every registered route intent. */
export type RouteTransitionOutcome =
  | {
      readonly intentKey: string;
      readonly noteId: string;
      readonly requestSequence: number;
      readonly status: "applied";
      readonly surfaceEffect: "replaced";
      readonly view: "missing" | "missing_draft" | "ready";
    }
  | {
      readonly intentKey: string;
      readonly noteId: undefined;
      readonly requestSequence: undefined;
      readonly status: "applied";
      readonly surfaceEffect: "replaced";
      readonly view: "empty";
    }
  | {
      readonly intentKey: string;
      readonly noteId: string;
      readonly status: "coherent_noop";
      readonly surfaceEffect: "retained";
      readonly view: "error" | "missing" | "missing_draft" | "ready";
    }
  | {
      readonly intentKey: string;
      readonly noteId: undefined;
      readonly status: "coherent_noop";
      readonly surfaceEffect: "retained";
      readonly view: "empty";
    }
  | {
      readonly intentKey: string;
      readonly noteId: string | undefined;
      readonly phase:
        | "awaiting_executor"
        | "awaiting_gate"
        | "awaiting_history_restore"
        | "awaiting_location"
        | "awaiting_notes"
        | "awaiting_read";
      readonly status: "superseded";
      readonly surfaceEffect: "none";
    }
  | {
      readonly historyEffect:
        | "entry_not_committed"
        | "not_needed"
        | "traversal_restored";
      readonly intentKey: string;
      readonly noteId: string | undefined;
      readonly reason: Extract<RouteGateResult, { status: "cancel" }>["reason"];
      readonly status: "cancelled";
      readonly surfaceEffect: "retained";
    }
  | {
      readonly intentKey: string;
      readonly noteId: string | undefined;
      readonly reason:
        | "navigation_rejected"
        | "notes_list_failed"
        | "store_apply_failed";
      readonly status: "failed";
      readonly surfaceEffect: "retained";
    }
  | {
      readonly degradation: "route_history_unavailable";
      readonly intentKey: string;
      readonly noteId: string | undefined;
      readonly reason: "history_restore_failed";
      readonly status: "failed";
      readonly surfaceEffect: "retained";
    }
  | {
      readonly intentKey: string;
      readonly noteId: string;
      readonly reason: "note_read_failed";
      readonly status: "failed";
      readonly surfaceEffect: "replaced_by_error";
    }
  | {
      readonly intentKey: string;
      readonly noteId: string | undefined;
      readonly reason: "owner_disposed";
      readonly status: "failed";
      readonly surfaceEffect: "none";
    };

/** Target-free terminal notification for one gate lease. */
export type RouteGateSettlement = {
  readonly leaseKey: string;
  readonly surfaceEffect: RouteTransitionOutcome["surfaceEffect"];
  readonly terminalStatus: RouteTransitionOutcome["status"];
};

/** Replaceable runtime capability used before destructive route work. */
export type RouteTransitionGate = {
  readonly prepare: (
    input: RouteGatePrepareInput,
  ) => Promise<RouteGateResult> | RouteGateResult;
  readonly settle: (
    settlement: RouteGateSettlement,
  ) => Promise<void> | void;
};

/** User-facing degraded history state produced when restoration is unconfirmed. */
export type RouteHistoryStatus =
  | { readonly status: "available" }
  | {
      readonly message: string;
      readonly reason: "route_history_unavailable";
      readonly status: "degraded";
    };
