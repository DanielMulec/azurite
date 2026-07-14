import type { RouteGateSettlement } from "../routing/route-transition-types.js";

/** Captures the focused outgoing control for restoration after cancellation. */
export function getFocusedElement(): HTMLElement | undefined {
  return typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined;
}

/** Restores focus only while the exact outgoing element remains connected. */
export function restoreFocus(element: HTMLElement | undefined): void {
  if (element?.isConnected === true) {
    element.focus();
  }
}

/** Returns whether Slice 7C retained the outgoing editor surface. */
export function retainedSurface(
  surfaceEffect: RouteGateSettlement["surfaceEffect"],
): boolean {
  return retainedSurfaceEffects.has(surfaceEffect);
}

const retainedSurfaceEffects = new Set<RouteGateSettlement["surfaceEffect"]>([
  "none",
  "retained",
]);
