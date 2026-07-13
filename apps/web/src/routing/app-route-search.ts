import { noteIdSchema } from "@azurite/shared";

/** Typed URL search state owned by Azurite's root route. */
export type AppSearch = {
  readonly "azurite-dev"?: "sentry-test";
  readonly note?: string;
};

/** Parses the URL-owned note selection search state. */
export function parseAppSearch(search: Record<string, unknown>): AppSearch {
  const parsedNote =
    typeof search.note === "string" ? parseSafeRouteNote(search.note) : {};

  if (search["azurite-dev"] === "sentry-test") {
    return { ...parsedNote, "azurite-dev": "sentry-test" };
  }

  return parsedNote;
}

/** Parses browser URL search text through one URL-decoding boundary. */
export function parseAppLocationSearch(locationSearch: string): AppSearch {
  const parameters = new URLSearchParams(locationSearch);
  return parseAppSearch({
    "azurite-dev": parameters.get("azurite-dev") ?? undefined,
    note: parameters.get("note") ?? undefined,
  });
}

/** Returns whether raw search named a note rejected by the safe note boundary. */
export function hasInvalidNoteSearch(locationSearch: string): boolean {
  const parameters = new URLSearchParams(locationSearch);
  if (!parameters.has("note")) {
    return false;
  }
  return parseSafeRouteNote(parameters.get("note") ?? "").note === undefined;
}

/** Creates search state for a note while preserving recognized diagnostics. */
export function createNoteNavigationSearch(
  currentSearch: AppSearch,
  noteId: string,
): AppSearch {
  if (currentSearch["azurite-dev"] === "sentry-test") {
    return { "azurite-dev": "sentry-test", note: noteId };
  }

  return { note: noteId };
}

/** Serializes validated search without changing pathname or hash. */
export function serializeAppSearch(search: AppSearch): string {
  const parameters = new URLSearchParams();
  appendNoteSearch(parameters, search.note);
  appendDiagnosticsSearch(parameters, search["azurite-dev"]);
  const serialized = parameters.toString();
  return serialized.length === 0 ? "" : `?${serialized}`;
}

function appendNoteSearch(
  parameters: URLSearchParams,
  noteId: string | undefined,
): void {
  if (noteId !== undefined) {
    parameters.set("note", noteId);
  }
}

function appendDiagnosticsSearch(
  parameters: URLSearchParams,
  diagnostics: AppSearch["azurite-dev"],
): void {
  if (diagnostics !== undefined) {
    parameters.set("azurite-dev", diagnostics);
  }
}

function parseSafeRouteNote(note: string): AppSearch {
  const parsedNote = noteIdSchema.safeParse(note);

  return parsedNote.success ? { note: parsedNote.data } : {};
}
