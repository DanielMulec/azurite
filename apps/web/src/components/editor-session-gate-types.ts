import type {
  CommitCause,
  CommitResult,
} from "../domain/markdown-authority-types.js";
import type { RouteTransitionGate } from "../routing/route-transition-types.js";

/** Narrow controller capability retained outside Zustand and browser storage. */
export type EditorControllerCapability = {
  readonly commit: (cause: CommitCause) => CommitResult;
  readonly sessionKey: string;
};

/** Accessible React render state for one destructive editor operation. */
export type EditorSessionGateSnapshot = {
  readonly frozenSessionKey: string | undefined;
  readonly message: string | undefined;
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
    action: () => Promise<void>,
  ) => Promise<void>;
  readonly subscribe: (listener: () => void) => () => void;
};
