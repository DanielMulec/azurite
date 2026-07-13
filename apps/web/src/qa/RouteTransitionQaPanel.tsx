import type { ReactElement } from "react";
import { useSyncExternalStore } from "react";

import type { RouteTransitionQaController } from "./route-transition-controller.js";

type RouteTransitionQaPanelProps = {
  readonly controller: RouteTransitionQaController;
};

/** Visible controls for the dedicated, non-product Slice 7C acceptance entry. */
export function RouteTransitionQaPanel({
  controller,
}: RouteTransitionQaPanelProps): ReactElement {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const isHolding = snapshot.state === "holding";

  return (
    <aside className="fixed bottom-3 right-3 z-50 w-[min(28rem,calc(100vw-1.5rem))] rounded-lg border border-slate-600 bg-slate-950 p-3 text-xs text-slate-100 shadow-xl">
      <div className="flex flex-wrap items-center gap-2">
        <strong>Slice 7C route QA</strong>
        <output data-testid="route-qa-state">{snapshot.state}</output>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 break-all">
        <dt>Lease</dt>
        <dd data-testid="route-qa-lease">{snapshot.leaseKey ?? "—"}</dd>
        <dt>Outgoing owner</dt>
        <dd data-testid="route-qa-owner">{snapshot.outgoingOwnerKey ?? "—"}</dd>
        <dt>Settlements</dt>
        <dd data-testid="route-qa-settlements">
          {String(snapshot.settlements.length)}
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <ControlButton label="Hold next" onClick={controller.holdNext} />
        <ControlButton
          disabled={!isHolding}
          label="Continue"
          onClick={controller.continueHeld}
        />
        <ControlButton
          disabled={!isHolding}
          label="Cancel"
          onClick={controller.cancelHeld}
        />
        <ControlButton
          disabled={!isHolding}
          label="Throw prepare"
          onClick={controller.throwHeldPrepare}
        />
        <ControlButton
          disabled={!isHolding}
          label="Throw settle"
          onClick={controller.throwHeldSettle}
        />
        <ControlButton
          label="Fail restore confirmation"
          onClick={controller.failNextRestorationConfirmation}
        />
        <ControlButton label="Reset" onClick={controller.reset} />
      </div>
    </aside>
  );
}

function ControlButton({
  disabled = false,
  label,
  onClick,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      className="rounded border border-slate-500 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
