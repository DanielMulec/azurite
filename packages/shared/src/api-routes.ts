/** Stable API route paths shared by server handlers, clients, and tests. */
export const apiRoutes = {
  health: "/health",
  noteContent: "/api/notes/content",
  notes: "/api/notes",
} as const;

/** Stable API query parameter names shared by server handlers, clients, and tests. */
export const apiQueryParameters = {
  noteId: "noteId",
} as const;

/** Builds the read-note route with an encoded workspace-relative note ID. */
export function createNoteContentRoute(noteId: string): string {
  const queryParameters = new URLSearchParams({
    [apiQueryParameters.noteId]: noteId,
  });

  return `${apiRoutes.noteContent}?${queryParameters.toString()}`;
}

/** Returns the stable route path used to save an existing markdown note. */
export function createSaveNoteRoute(): string {
  return apiRoutes.noteContent;
}
