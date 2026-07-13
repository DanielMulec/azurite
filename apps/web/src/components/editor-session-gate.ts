import type { StoreApi } from "zustand/vanilla";

import type {
  CommitCause,
  CommitResult,
} from "../domain/markdown-authority-types.js";
import type { DurabilityResult } from "../persistence/draft-workflow-types.js";
import type {
  RouteGatePrepareInput,
  RouteGateResult,
  RouteGateSettlement,
  RouteTransitionGate,
} from "../routing/route-transition-types.js";
import type { NoteBrowserStore } from "../state/note-browser-contracts.js";

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
    cause: "pagehide" | "visibilitychange",
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

type ActiveLease = {
  readonly controller: EditorControllerCapability;
  readonly focusedElement: HTMLElement | undefined;
  readonly sessionKey: string;
};

type SharedPreparation = Promise<{
  readonly commit: Exclude<CommitResult, { status: "failed" }>;
  readonly durability: DurabilityResult;
}>;

/** Creates one ephemeral session gate around a note-browser store. */
export function createEditorSessionGate(
  store: StoreApi<NoteBrowserStore>,
): EditorSessionGate {
  const runtime = new EditorSessionGateRuntime(store);
  return {
    commitCurrent: (cause) => runtime.commitCurrent(cause),
    commitLifecycle: async (cause) => {
      await runtime.commitLifecycle(cause);
    },
    getSnapshot: runtime.getSnapshot,
    isSessionFrozen: (sessionKey) => runtime.isSessionFrozen(sessionKey),
    registerController: (controller) => runtime.registerController(controller),
    routeGate: {
      prepare: async (input) => mapRouteResult(await runtime.prepare(input)),
      settle: (settlement) => {
        runtime.settle(settlement);
      },
    },
    runTerminalAction: async (sessionKey, action) => {
      await runtime.runTerminalAction(sessionKey, action);
    },
    subscribe: runtime.subscribe,
  };
}

class EditorSessionGateRuntime {
  readonly #controllers = new Map<string, EditorControllerCapability>();
  readonly #leases = new Map<string, ActiveLease>();
  readonly #listeners = new Set<() => void>();
  readonly #preparations = new Map<string, SharedPreparation>();
  readonly #store: StoreApi<NoteBrowserStore>;
  #snapshot: EditorSessionGateSnapshot = {
    frozenSessionKey: undefined,
    message: undefined,
  };

  constructor(store: StoreApi<NoteBrowserStore>) {
    this.#store = store;
  }

  getSnapshot = (): EditorSessionGateSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  registerController(controller: EditorControllerCapability): () => void {
    this.#controllers.set(controller.sessionKey, controller);
    return () => {
      if (this.#controllers.get(controller.sessionKey) === controller) {
        this.#controllers.delete(controller.sessionKey);
      }
    };
  }

  commitCurrent(cause: CommitCause): CommitResult | undefined {
    const controller = this.#getCurrentController();
    return controller?.commit(cause);
  }

  async commitLifecycle(cause: "pagehide" | "visibilitychange"): Promise<void> {
    const commit = this.commitCurrent(cause);
    if (commit?.status === "failed") {
      return;
    }
    await this.#store.getState().flushPendingDraft(cause);
  }

  isSessionFrozen(sessionKey: string): boolean {
    return this.#snapshot.frozenSessionKey === sessionKey;
  }

  async prepare(
    input: RouteGatePrepareInput,
  ): Promise<EditorGatePreparationResult> {
    if (input.outgoingOwnerKey === undefined || this.#hasNoEditor()) {
      return {
        leaseKey: input.leaseKey,
        reason: "no_editor_session",
        sessionKey: undefined,
        status: "continue",
      };
    }
    const controller = this.#controllers.get(input.outgoingOwnerKey);
    if (controller === undefined) {
      return {
        leaseKey: input.leaseKey,
        reason: "owner_lost",
        sessionKey: input.outgoingOwnerKey,
        status: "cancel",
      };
    }
    let preparation = this.#preparations.get(controller.sessionKey);
    if (preparation === undefined) {
      const commit = controller.commit("route_transition");
      if (commit.status === "failed") {
        return {
          commit,
          leaseKey: input.leaseKey,
          reason: "commit_failed",
          sessionKey: controller.sessionKey,
          status: "cancel",
        };
      }
      preparation = this.#startPreparation(controller, commit);
      this.#preparations.set(controller.sessionKey, preparation);
    }
    this.#activateLease(input.leaseKey, controller);
    const result = await preparation;
    if (result.durability.status === "unavailable") {
      return {
        commit: result.commit,
        durability: result.durability,
        leaseKey: input.leaseKey,
        reason: "durability_unavailable",
        sessionKey: controller.sessionKey,
        status: "cancel",
      };
    }
    return {
      commit: result.commit,
      durability: result.durability,
      leaseKey: input.leaseKey,
      sessionKey: controller.sessionKey,
      status: "continue",
    };
  }

  settle(settlement: RouteGateSettlement): void {
    const lease = this.#leases.get(settlement.leaseKey);
    if (lease === undefined) {
      return;
    }
    this.#leases.delete(settlement.leaseKey);
    if (this.#hasLeaseForSession(lease.sessionKey)) {
      return;
    }
    this.#preparations.delete(lease.sessionKey);
    if (
      (settlement.surfaceEffect === "retained" ||
        settlement.surfaceEffect === "none") &&
      this.#controllers.get(lease.sessionKey) === lease.controller
    ) {
      lease.controller.setFrozen(false);
      restoreFocus(lease.focusedElement);
    }
    this.#publishSnapshot();
  }

  async runTerminalAction(
    sessionKey: string,
    action: () => Promise<void>,
  ): Promise<void> {
    const controller = this.#controllers.get(sessionKey);
    if (controller === undefined) {
      return;
    }
    controller.setFrozen(true);
    this.#setSnapshot(sessionKey, "Discarding browser draft...");
    try {
      await action();
    } finally {
      if (this.#controllers.get(sessionKey) === controller) {
        controller.setFrozen(false);
        this.#publishSnapshot();
      }
    }
  }

  #startPreparation(
    controller: EditorControllerCapability,
    commit: Exclude<CommitResult, { status: "failed" }>,
  ): SharedPreparation {
    return this.#store
      .getState()
      .flushPendingDraft("route_transition")
      .then(
        (durability) => ({ commit, durability }),
        () => ({
          commit,
          durability: unavailableQueueDurability(controller, this.#store),
        }),
      );
  }

  #activateLease(
    leaseKey: string,
    controller: EditorControllerCapability,
  ): void {
    const focusedElement = getFocusedElement();
    this.#leases.set(leaseKey, {
      controller,
      focusedElement,
      sessionKey: controller.sessionKey,
    });
    controller.setFrozen(true);
    this.#setSnapshot(controller.sessionKey, "Opening note...");
  }

  #getCurrentController(): EditorControllerCapability | undefined {
    const owner = this.#store.getState().getRenderedOwnerKey();
    return owner === undefined ? undefined : this.#controllers.get(owner);
  }

  #hasNoEditor(): boolean {
    const noteState = this.#store.getState().noteState;
    return noteState.status !== "ready";
  }

  #hasLeaseForSession(sessionKey: string): boolean {
    return Array.from(this.#leases.values()).some(
      (lease) => lease.sessionKey === sessionKey,
    );
  }

  #publishSnapshot(): void {
    const active = this.#leases.values().next().value as
      ActiveLease | undefined;
    this.#setSnapshot(
      active?.sessionKey,
      active === undefined ? undefined : "Opening note...",
    );
  }

  #setSnapshot(
    frozenSessionKey: string | undefined,
    message: string | undefined,
  ): void {
    this.#snapshot = { frozenSessionKey, message };
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function mapRouteResult(result: EditorGatePreparationResult): RouteGateResult {
  if (result.status === "continue") {
    return { status: "continue" };
  }
  const reason =
    result.reason === "owner_lost"
      ? "outgoing_owner_lost"
      : result.reason === "commit_failed"
        ? "prerequisite_failed"
        : "prerequisite_unavailable";
  return { reason, status: "cancel" };
}

function getFocusedElement(): HTMLElement | undefined {
  return typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined;
}

function restoreFocus(element: HTMLElement | undefined): void {
  if (element?.isConnected) {
    element.focus();
  }
}

function unavailableQueueDurability(
  controller: EditorControllerCapability,
  store: StoreApi<NoteBrowserStore>,
): Extract<DurabilityResult, { status: "unavailable" }> {
  const noteState = store.getState().noteState;
  const editor =
    noteState.status === "ready" &&
    noteState.editor.sessionKey === controller.sessionKey
      ? noteState.editor
      : undefined;
  return {
    cause: "route_transition",
    clusterId: editor?.persistenceIssue?.clusterId,
    disposition: editor?.draftDisposition ?? "none",
    failure: { reason: "queue_task_failed", source: "coordinator" },
    noteId: editor?.note.id ?? "",
    revision: editor?.revision ?? 0,
    sessionKey: controller.sessionKey,
    snapshotKey: editor?.lastSnapshotKey,
    status: "unavailable",
  };
}
