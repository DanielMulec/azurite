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
  if (search.note !== undefined) {
    parameters.set("note", search.note);
  }
  if (search["azurite-dev"] !== undefined) {
    parameters.set("azurite-dev", search["azurite-dev"]);
  }
  const serialized = parameters.toString();
  return serialized.length === 0 ? "" : `?${serialized}`;
}

function parseSafeRouteNote(note: string): AppSearch {
  const parsedNote = noteIdSchema.safeParse(note);

  return parsedNote.success ? { note: parsedNote.data } : {};
}
