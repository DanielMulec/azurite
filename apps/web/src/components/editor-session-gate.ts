import type { StoreApi } from "zustand/vanilla";

import type {
  CommitCause,
  CommitResult,
} from "../domain/markdown-authority-types.js";
import type { DurabilityResult } from "../persistence/draft-workflow-types.js";
import type {
  RouteGatePrepareInput,
  RouteGateSettlement,
} from "../routing/route-transition-types.js";
import type { NoteBrowserStore } from "../state/note-browser-contracts.js";
import {
  createUnavailableQueueDurability,
  getFocusedElement,
  mapEditorRouteResult,
  restoreFocus,
  retainedSurface,
} from "./editor-session-gate-results.js";
import type {
  EditorControllerCapability,
  EditorGatePreparationResult,
  EditorSessionGate,
  EditorSessionGateSnapshot,
} from "./editor-session-gate-types.js";
export type {
  EditorControllerCapability,
  EditorGatePreparationResult,
  EditorSessionGate,
  EditorSessionGateSnapshot,
} from "./editor-session-gate-types.js";

type ActiveLease = {
  readonly controller: EditorControllerCapability;
  readonly focusedElement: HTMLElement | undefined;
  readonly sessionKey: string;
};

type SharedPreparation = Promise<{
  readonly commit: Exclude<CommitResult, { status: "failed" }>;
  readonly durability: DurabilityResult;
}>;

type ResolvedPreparationOwner =
  | {
      readonly controller: EditorControllerCapability;
      readonly status: "ready";
    }
  | {
      readonly result: EditorGatePreparationResult;
      readonly status: "resolved";
    };

type AcquiredPreparation =
  | { readonly preparation: SharedPreparation; readonly status: "ready" }
  | {
      readonly result: EditorGatePreparationResult;
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
      prepare: async (input) =>
        mapEditorRouteResult(await runtime.prepare(input)),
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
    const owner = this.#resolvePreparationOwner(input);
    if (owner.status === "resolved") {
      return owner.result;
    }
    const acquired = this.#acquirePreparation(owner.controller, input.leaseKey);
    if (acquired.status === "resolved") {
      return acquired.result;
    }
    this.#activateLease(input.leaseKey, owner.controller);
    return await this.#resolvePreparation(
      input.leaseKey,
      owner.controller,
      acquired.preparation,
    );
  }

  #resolvePreparationOwner(
    input: RouteGatePrepareInput,
  ): ResolvedPreparationOwner {
    if (input.outgoingOwnerKey === undefined) {
      return this.#noEditorOwner(input.leaseKey);
    }
    if (this.#hasNoEditor()) {
      return this.#noEditorOwner(input.leaseKey);
    }
    return this.#resolveControllerOwner(input.leaseKey, input.outgoingOwnerKey);
  }

  #noEditorOwner(leaseKey: string): ResolvedPreparationOwner {
    return {
      result: {
        leaseKey,
        reason: "no_editor_session",
        sessionKey: undefined,
        status: "continue",
      },
      status: "resolved",
    };
  }

  #resolveControllerOwner(
    leaseKey: string,
    ownerKey: string,
  ): ResolvedPreparationOwner {
    const controller = this.#controllers.get(ownerKey);
    if (controller !== undefined) {
      return { controller, status: "ready" };
    }
    return {
      result: {
        leaseKey,
        reason: "owner_lost",
        sessionKey: ownerKey,
        status: "cancel",
      },
      status: "resolved",
    };
  }

  #acquirePreparation(
    controller: EditorControllerCapability,
    leaseKey: string,
  ): AcquiredPreparation {
    const existing = this.#preparations.get(controller.sessionKey);
    if (existing !== undefined) {
      return { preparation: existing, status: "ready" };
    }
    const commit = controller.commit("route_transition");
    if (commit.status === "failed") {
      return {
        result: {
          commit,
          leaseKey,
          reason: "commit_failed",
          sessionKey: controller.sessionKey,
          status: "cancel",
        },
        status: "resolved",
      };
    }
    const preparation = this.#startPreparation(controller, commit);
    this.#preparations.set(controller.sessionKey, preparation);
    return { preparation, status: "ready" };
  }

  async #resolvePreparation(
    leaseKey: string,
    controller: EditorControllerCapability,
    preparation: SharedPreparation,
  ): Promise<EditorGatePreparationResult> {
    const result = await preparation;
    if (result.durability.status === "unavailable") {
      return {
        commit: result.commit,
        durability: result.durability,
        leaseKey,
        reason: "durability_unavailable",
        sessionKey: controller.sessionKey,
        status: "cancel",
      };
    }
    return {
      commit: result.commit,
      durability: result.durability,
      leaseKey,
      sessionKey: controller.sessionKey,
      status: "continue",
    };
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
    lease.controller.setFrozen(false);
    restoreFocus(lease.focusedElement);
  }

  async runTerminalAction(
    sessionKey: string,
    action: () => Promise<unknown>,
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
          durability: createUnavailableQueueDurability(controller, this.#store),
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
