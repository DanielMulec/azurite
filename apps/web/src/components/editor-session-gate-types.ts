import type {
  CommitCause,
  CommitResult,
} from "../domain/markdown-authority-types.js";
import type { DurabilityResult } from "../persistence/draft-workflow-types.js";
import type { RouteTransitionGate } from "../routing/route-transition-types.js";

/** Narrow controller capability retained outside Zustand and browser storage. */
export type EditorControllerCapability = {
  readonly commit: (cause: CommitCause) => CommitResult;
  readonly sessionKey: string;
  readonly setFrozen: (frozen: boolean) => void;
};

/** Accessible React render state for one destructive editor operation. */
export type EditorSessionGateSnapshot = {
  readonly frozenSessionKey: string | undefined;
  readonly message: string | undefined;
};

/** Exact internal preparation result before mapping onto Slice 7C. */
export type EditorGatePreparationResult =
  | {
      readonly leaseKey: string;
      readonly reason: "no_editor_session";
      readonly sessionKey: undefined;
      readonly status: "continue";
    }
  | {
      readonly commit: Exclude<CommitResult, { status: "failed" }>;
      readonly durability: Exclude<DurabilityResult, { status: "unavailable" }>;
      readonly leaseKey: string;
      readonly sessionKey: string;
      readonly status: "continue";
    }
  | {
      readonly commit: Extract<CommitResult, { status: "failed" }>;
      readonly leaseKey: string;
      readonly reason: "commit_failed";
      readonly sessionKey: string;
      readonly status: "cancel";
    }
  | {
      readonly commit: Exclude<CommitResult, { status: "failed" }>;
      readonly durability: Extract<DurabilityResult, { status: "unavailable" }>;
      readonly leaseKey: string;
      readonly reason: "durability_unavailable";
      readonly sessionKey: string;
      readonly status: "cancel";
    }
  | {
      readonly leaseKey: string;
      readonly reason: "owner_lost";
      readonly sessionKey: string;
      readonly status: "cancel";
    };

/** React-owned editor gate used by route, Save, lifecycle, and Discard actions. */
export type EditorSessionGate = {
  readonly commitCurrent: (cause: CommitCause) => CommitResult | undefined;
  readonly commitLifecycle: (
    cause: "pagehide" | "unmount" | "visibilitychange",
  ) => Promise<void>;
  readonly getSnapshot: () => EditorSessionGateSnapshot;
  readonly isSessionFrozen: (sessionKey: string) => boolean;
  readonly registerController: (
    controller: EditorControllerCapability,
  ) => () => void;
  readonly routeGate: RouteTransitionGate;
  readonly runTerminalAction: (
    sessionKey: string,
    action: () => Promise<unknown>,
  ) => Promise<void>;
  readonly subscribe: (listener: () => void) => () => void;
};
