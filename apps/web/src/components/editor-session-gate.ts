import type { StoreApi } from "zustand/vanilla";

import type {
  CommitCause,
  CommitResult,
} from "../domain/markdown-authority-types.js";
import type { HandoffDecision } from "../persistence/draft-workflow-types.js";
import type {
  RouteGatePrepareInput,
  RouteGateResult,
  RouteGateSettlement,
} from "../routing/route-transition-types.js";
import type { NoteBrowserStore } from "../state/note-browser-contracts.js";
import { getRenderedOwnerKey } from "../state/note-browser-route-predicates.js";
import {
  getFocusedElement,
  restoreFocus,
  retainedSurface,
} from "./editor-session-gate-results.js";
import type {
  EditorControllerCapability,
  EditorSessionGate,
  EditorSessionGateSnapshot,
} from "./editor-session-gate-types.js";
export type {
  EditorControllerCapability,
  EditorSessionGate,
  EditorSessionGateSnapshot,
} from "./editor-session-gate-types.js";

type ActiveLease = {
  readonly controller: EditorControllerCapability;
  readonly focusedElement: HTMLElement | undefined;
  readonly sessionKey: string;
};

type SharedPreparation = Promise<HandoffDecision>;

type ResolvedPreparationOwner =
  | {
      readonly controller: EditorControllerCapability;
      readonly status: "ready";
    }
  | {
      readonly result: RouteGateResult;
      readonly status: "resolved";
    };

type AcquiredPreparation =
  | { readonly preparation: SharedPreparation; readonly status: "ready" }
  | {
      readonly result: RouteGateResult;
      readonly status: "resolved";
    };

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
      prepare: async (input) => await runtime.prepare(input),
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

  async commitLifecycle(
    cause: "pagehide" | "unmount" | "visibilitychange",
  ): Promise<void> {
    const commit = this.commitCurrent(cause);
    if (commit?.status === "block") {
      return;
    }
    await this.#store.getState().flushPendingDraft(cause);
  }

  isSessionFrozen(sessionKey: string): boolean {
    return this.#snapshot.frozenSessionKey === sessionKey;
  }

  async prepare(input: RouteGatePrepareInput): Promise<RouteGateResult> {
    const owner = this.#resolvePreparationOwner(input);
    if (owner.status === "resolved") {
      return owner.result;
    }
    const acquired = this.#acquirePreparation(owner.controller);
    if (acquired.status === "resolved") {
      return acquired.result;
    }
    this.#activateLease(input.leaseKey, owner.controller);
    return await this.#resolvePreparation(acquired.preparation);
  }

  #resolvePreparationOwner(
    input: RouteGatePrepareInput,
  ): ResolvedPreparationOwner {
    if (input.outgoingOwnerKey === undefined) {
      return this.#noEditorOwner();
    }
    if (this.#hasNoEditor()) {
      return this.#noEditorOwner();
    }
    return this.#resolveControllerOwner(input.outgoingOwnerKey);
  }

  #noEditorOwner(): ResolvedPreparationOwner {
    return {
      result: { status: "continue" },
      status: "resolved",
    };
  }

  #resolveControllerOwner(ownerKey: string): ResolvedPreparationOwner {
    const controller = this.#controllers.get(ownerKey);
    if (controller !== undefined) {
      return { controller, status: "ready" };
    }
    return {
      result: {
        reason: "outgoing_owner_lost",
        status: "cancel",
      },
      status: "resolved",
    };
  }

  #acquirePreparation(
    controller: EditorControllerCapability,
  ): AcquiredPreparation {
    const existing = this.#preparations.get(controller.sessionKey);
    if (existing !== undefined) {
      return { preparation: existing, status: "ready" };
    }
    const commit = controller.commit("route_transition");
    if (commit.status === "block") {
      return {
        result: {
          reason: "prerequisite_failed",
          status: "cancel",
        },
        status: "resolved",
      };
    }
    const preparation = this.#startPreparation();
    this.#preparations.set(controller.sessionKey, preparation);
    return { preparation, status: "ready" };
  }

  async #resolvePreparation(
    preparation: SharedPreparation,
  ): Promise<RouteGateResult> {
    const decision = await preparation;
    if (decision.status === "block") {
      return {
        reason: "prerequisite_unavailable",
        status: "cancel",
      };
    }
    return { status: "continue" };
  }

  settle(settlement: RouteGateSettlement): void {
    const lease = this.#takeLease(settlement.leaseKey);
    if (lease === undefined) {
      return;
    }
    if (this.#hasLeaseForSession(lease.sessionKey)) {
      return;
    }
    this.#preparations.delete(lease.sessionKey);
    this.#restoreSettledLease(lease, settlement);
    this.#publishSnapshot();
  }

  #takeLease(leaseKey: string): ActiveLease | undefined {
    const lease = this.#leases.get(leaseKey);
    this.#leases.delete(leaseKey);
    return lease;
  }

  #restoreSettledLease(
    lease: ActiveLease,
    settlement: RouteGateSettlement,
  ): void {
    if (!retainedSurface(settlement.surfaceEffect)) {
      return;
    }
    if (this.#controllers.get(lease.sessionKey) !== lease.controller) {
      return;
    }
    restoreFocus(lease.focusedElement);
  }

  async runTerminalAction(
    sessionKey: string,
    action: () => Promise<void>,
  ): Promise<void> {
    const controller = this.#controllers.get(sessionKey);
    if (controller === undefined) {
      return;
    }
    this.#setSnapshot(sessionKey, "Discarding browser draft...");
    try {
      await action();
    } finally {
      if (this.#controllers.get(sessionKey) === controller) {
        this.#publishSnapshot();
      }
    }
  }

  #startPreparation(): SharedPreparation {
    return this.#store
      .getState()
      .flushPendingDraft("route_transition")
      .then(
        (decision) => decision,
        () => blockedQueueHandoff,
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
    this.#setSnapshot(controller.sessionKey, "Opening note...");
  }

  #getCurrentController(): EditorControllerCapability | undefined {
    const owner = getRenderedOwnerKey(this.#store.getState());
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
    const active = this.#leases.values().next().value;
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

const blockedQueueHandoff: HandoffDecision = Object.freeze({
  failure: { reason: "queue_task_failed", source: "coordinator" } as const,
  status: "block",
});
