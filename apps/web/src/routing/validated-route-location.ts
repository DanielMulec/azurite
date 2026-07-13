import type { HistoryLocation } from "@tanstack/react-router";

import {
  parseAppLocationSearch,
  serializeAppSearch,
} from "./app-route-search.js";
import type {
  RouteNavigationKind,
  ValidatedLocationOccurrence,
} from "./route-transition-types.js";

/** Private history-state key recognizing one expected application echo. */
export const applicationNavigationTokenStateKey =
  "__azurite_navigation_token";

/** Validates one raw TanStack history location into product-owned route state. */
export function validateLocationOccurrence(
  location: HistoryLocation,
  generation: number,
): ValidatedLocationOccurrence {
  const historyKey = location.state.__TSR_key;
  const historyIndex = location.state.__TSR_index;

  if (typeof historyKey !== "string" || !Number.isInteger(historyIndex)) {
    throw new Error("TanStack history location identity is unavailable.");
  }

  return Object.freeze({
    generation,
    hash: location.hash,
    historyIndex,
    historyKey,
    href: location.href,
    pathname: location.pathname,
    search: parseAppLocationSearch(location.search),
  });
}

/** Returns the safe canonical href for one validated occurrence. */
export function getCanonicalOccurrenceHref(
  occurrence: ValidatedLocationOccurrence,
): string {
  return `${occurrence.pathname}${serializeAppSearch(occurrence.search)}${occurrence.hash}`;
}

/** Returns whether raw search contains state removed by route validation. */
export function needsCanonicalReplacement(
  location: HistoryLocation,
  occurrence: ValidatedLocationOccurrence,
): boolean {
  return location.href !== getCanonicalOccurrenceHref(occurrence);
}

/** Reads a pending application token without trusting other history state. */
export function readApplicationNavigationToken(
  location: HistoryLocation,
): string | undefined {
  const token = location.state.__azurite_navigation_token;
  return typeof token === "string" ? token : undefined;
}

/** Maps TanStack's action into Azurite's exact navigation kind. */
export function toTraversalNavigationKind(
  action: "BACK" | "FORWARD" | "GO",
): RouteNavigationKind {
  if (action === "BACK") {
    return "history_back";
  }
  if (action === "FORWARD") {
    return "history_forward";
  }
  return "history_go";
}

/** Compares exact stored history occurrence identity. */
export function isSameHistoryOccurrence(
  left: ValidatedLocationOccurrence,
  right: ValidatedLocationOccurrence,
): boolean {
  return (
    left.historyKey === right.historyKey &&
    left.historyIndex === right.historyIndex &&
    left.href === right.href
  );
}
