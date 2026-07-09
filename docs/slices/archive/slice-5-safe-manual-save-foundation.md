# Slice 5: Safe Manual Save Foundation

## Status

Implemented on July 8, 2026.

This slice adds explicit manual saving for existing markdown notes. It turns the
Milkdown and Crepe editor surface from a local draft surface into a safe
markdown writer while keeping autosave, merge UI, file creation, rename, delete,
backlinks, graph behavior, search, indexing, and file watching out of scope.

Implementation added the shared save contract, content hashes, safe core note
writes, server save route, web API save client, and editor save state UI for
existing markdown notes.

Verification completed:

- `pnpm validate`
- focused `@azurite/web` test and typecheck after the CRLF dirty-state fix
- browser QA against `/tmp/azurite-slice5-qa.yJ038O`, not Daniel's real
  knowledgebase
- source-mode save persisted to disk and preserved CRLF-dominant line endings
- browser refresh reloaded the saved content and updated note metadata
- WYSIWYG editing saved Crepe's current markdown to disk
- stale save after an external file edit returned `409 note_write_conflict`,
  showed `Changed on disk`, kept the browser draft intact, and did not
  overwrite the external file
- invalid traversal-style save request returned a safe typed error without
  exposing absolute filesystem paths
- mobile-sized and desktop-sized browser checks showed readable save UI without
  horizontal overflow or status/button overlap

## Product Decision

Implement manual save before autosave.

Autosave is still a good future Azurite experience, but it should reuse a
boringly correct write path instead of defining conflict, retry, and persistence
semantics at the same time as the first filesystem write. Slice 5 therefore
proves the write API, content-hash conflict protection, atomic replacement, and
basic save UI first.

## Goal

Given an existing selected markdown note, Azurite can:

- load the note with a content hash,
- let the user edit in WYSIWYG or markdown source mode,
- show whether the editor has unsaved changes,
- save the current editor markdown through an explicit Save action,
- persist the edited markdown to disk safely,
- reject stale saves when the note changed on disk after it was loaded,
- keep the user's unsaved editor content intact after a conflict or failed save,
- refresh note metadata after a successful save.

## Non-Goals

- Do not add autosave.
- Do not add merge UI for conflicts.
- Do not add file creation, rename, move, delete, duplicate, or restore.
- Do not add backups UI.
- Do not add file watching.
- Do not add backlinks, graph behavior, tags, search, or indexing.
- Do not save into SQLite or any derived index.
- Do not test first-run writes against Daniel's real knowledgebase.

## Terms

- Content hash: a deterministic fingerprint of the current markdown content.
- `contentHash`: the hash returned with a read or successful save response.
- `expectedContentHash`: the hash the client sends when saving, representing
  the exact on-disk content the current edit started from.
- Conflict: a save request whose `expectedContentHash` does not match the
  current on-disk note content hash.
- Atomic write: write to a temporary file in the same directory, then rename it
  over the target note after the write succeeds.

## API Contract

Extend the existing note content API instead of creating a parallel save route.

Read response shape changes from:

```ts
{
  note: NoteContent;
}
```

to:

```ts
{
  note: NoteContentWithHash;
}
```

where `NoteContentWithHash` extends the existing note content metadata with:

```ts
{
  contentHash: string;
}
```

Add:

```http
PUT /api/notes/content
```

Request:

```ts
{
  noteId: string;
  markdown: string;
  expectedContentHash: string;
}
```

Successful response:

```ts
{
  note: NoteContentWithHash;
}
```

Stale save response:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "note_write_conflict",
    "message": "The note changed on disk before Azurite could save it."
  }
}
```

HTTP status codes and Azurite error codes have separate jobs. The HTTP status
`409 Conflict` communicates the protocol-level result. The shared Azurite error
code communicates the typed product reason the frontend should handle.

Add shared error codes in `packages/shared`:

- `note_write_conflict`
- `note_write_failed`
- `invalid_note_save`

## Content Hash Decision

Use a content hash as the concurrency token.

The hash answers one question before writing: "Is the on-disk markdown still the
same markdown the editor loaded?" If another app, git operation, another tab, or
manual edit changes the file after Azurite loaded it, the current file hash will
not match `expectedContentHash`, and Azurite must reject the save instead of
overwriting unknown content.

Prefer a content hash over `lastModifiedAt` for conflict detection because a
hash fingerprints the file content itself. Timestamps are useful metadata, but
they can vary by filesystem precision, tool behavior, and timing edge cases.

Do not send the full original markdown back as the concurrency token. A hash is
the compact version stamp for the content the user started editing.

## Backend Plan

### 1. Extend Shared Contracts

Add shared route helpers, request schemas, response schemas, and error codes for
manual save.

Keep `noteId` validation centralized in the existing shared note ID schema.
Validate `markdown` as a string and `expectedContentHash` as a non-empty string.

### 2. Add Hashing Helper

Add a small core helper that hashes markdown content with a stable algorithm
available in Node's standard library.

Use the same helper for read responses and save conflict checks.

### 3. Extend Note Content Reads

Include `contentHash` when reading a note.

The hash must be computed from the exact markdown string returned to the client.

### 4. Add Safe Note Writing In Core

Add `writeWorkspaceNote` in `packages/core`.

It must:

- resolve the workspace root with the existing workspace root behavior,
- resolve `noteId` with the existing safe markdown note resolver,
- read the current markdown content from disk,
- compute the current content hash,
- compare the current hash with `expectedContentHash`,
- reject mismatches with a conflict error,
- preserve the existing file's dominant line ending style,
- write the requested markdown to a temporary file in the same directory,
- rename the temporary file over the target note only after the write succeeds,
- return freshly read note metadata, markdown, and new `contentHash`.

### 5. Preserve Line Endings Deliberately

Use this rule:

- If the existing file contains more CRLF line endings than LF-only line
  endings, save with CRLF.
- Otherwise save with LF.

Do not preserve mixed line endings in this slice.

### 6. Register The Write Route

Add `PUT /api/notes/content` in `apps/server`.

Map failures to safe API responses:

- invalid body or invalid note ID: `400` with `invalid_note_save` or
  `invalid_note_id`,
- missing note: `404` with `note_not_found`,
- stale content hash: `409` with `note_write_conflict`,
- workspace issue: `500` with `invalid_workspace`,
- unexpected write failure: `500` with `note_write_failed`.

Do not expose absolute filesystem paths in responses or logs intended for the
frontend.

## Frontend Plan

### 1. Extend The API Client

Add `saveNote` in `apps/web/src/api-client.ts`.

It should send `PUT /api/notes/content`, parse the shared save response schema,
and preserve `WebApiError.code` so the UI can distinguish conflicts from generic
save failures.

### 2. Track Save Baseline

The selected note editor must track:

- the latest saved markdown baseline,
- the latest saved `contentHash`,
- the current editor markdown,
- whether the editor is dirty,
- the current save status.

Dirty state is true when current editor markdown differs from the latest saved
markdown baseline.

### 3. Add Save UI

Add a quiet Save button near the existing local editing cue.

Show concise status text:

- `Saved`
- `Unsaved changes`
- `Saving...`
- `Changed on disk`
- `Save failed`

Disable Save while a save request is in flight or when there are no unsaved
changes.

### 4. Save Current Editor State

The Save action must save the current editor state, not stale initial markdown.

If the user is in markdown source mode, save the source-mode markdown. If the
user is in WYSIWYG mode, extract the current markdown from Crepe before saving.

### 5. Handle Save Success

After a successful save:

- update the markdown baseline,
- update `contentHash`,
- clear dirty state,
- show `Saved`,
- update selected note metadata,
- refresh or patch the note list so title, size, and modified time stay
  coherent.

### 6. Handle Conflict

On `note_write_conflict`:

- keep the user's editor content untouched,
- show `Changed on disk`,
- do not overwrite the file,
- require a later reload, conflict review, or merge-oriented slice to resolve
  the conflict.

No merge UI is required in Slice 5.

## Tests

Add focused coverage at each boundary.

Shared contract tests:

- read-note response includes `contentHash`,
- save-note request validates `noteId`, `markdown`, and `expectedContentHash`,
- save-note response includes `contentHash`,
- new API error codes are valid shared error codes.

Core tests:

- writes an existing markdown note successfully,
- returns a new content hash after save,
- rejects stale `expectedContentHash`,
- rejects invalid note IDs through existing note ID validation,
- preserves LF files as LF,
- preserves CRLF-dominant files as CRLF,
- does not leave a temporary file behind after success.

Server tests:

- `PUT /api/notes/content` saves and returns the updated note,
- invalid payload returns a safe `400`,
- missing note returns a safe `404`,
- stale hash returns `409` plus `note_write_conflict`,
- unexpected write failure returns a safe `500`.

Frontend tests:

- API client sends `PUT` with the expected payload,
- editor shows dirty state after local edits,
- Save calls the API with current markdown,
- successful save clears dirty state and updates the hash,
- conflict keeps editor content and shows the conflict state.

## Browser Verification

Use a temporary cluster, not Daniel's real knowledgebase.

Verify:

- edit a note, click Save, refresh, and confirm the content persists,
- edit a heading, save, and confirm note title/list metadata updates,
- externally change the file, then attempt a stale save and confirm Azurite
  shows a conflict without overwriting,
- source-mode edits save the source markdown,
- WYSIWYG edits save the extracted markdown,
- invalid note IDs cannot write outside the cluster,
- save errors do not expose absolute filesystem paths,
- desktop and mobile Tailscale views keep the save UI readable.

## Acceptance Criteria

- Existing notes can be saved manually from the selected note editor.
- Reads and saves use `contentHash` and `expectedContentHash`.
- Stale saves return HTTP `409 Conflict` with shared error code
  `note_write_conflict`.
- Save writes are atomic within the target note directory.
- Existing note ID/path traversal protections are reused for writes.
- LF and CRLF-dominant files keep their line-ending style.
- The frontend shows saved, dirty, saving, conflict, and failed states.
- Save success updates the editor baseline and note metadata.
- Conflicts keep the user's unsaved editor content intact.
- No autosave, create, rename, delete, merge UI, indexing, or file watching is
  added.
- `pnpm validate` passes.
- Browser verification passes against a temporary cluster.

## Follow-Up Slices

Slice 6 should add the client persistence and navigation foundation described
in `docs/slices/archive/slice-6-client-persistence-and-navigation-foundation.md`.

Phone QA after Slice 5 showed Android Chrome and Edge can reload Azurite when
Daniel switches apps, which loses the selected note and unsaved draft because
both currently live only in React memory. The fix should establish URL-owned
selected-note navigation, durable browser draft persistence, live client state,
and recovered conflict behavior while still saving through the Slice 5
content-hash conflict guard.

Slice 7 should add the end-to-end Sentry observability foundation for the
current browser, API, and filesystem-backed note workflow. Create-new-note
behavior moves later in the roadmap so Azurite can first debug real editor,
persistence, and mobile/Tailscale failures from a complete investigation
surface.

Slice 8 should add new markdown note creation.

It should decide the first creation location, filename validation, duplicate
filename handling, title behavior, optional folder creation, list refresh, URL
update, draft initialization, and auto-selection after creation.

Slice 9 should add recoverable delete or move-to-trash behavior.

It should decide whether deletion moves notes to a local trash area, the user's
system trash, or a workspace-local recovery folder. It should not introduce
permanent one-click deletion as the first delete experience.

Autosave should be a later separately numbered slice after manual save,
creation, and recoverable delete are stable.

It should decide debounce timing, queued saves, retry behavior, mobile sleep and
reconnect behavior, stale-save UX while typing, whether a manual Save Now escape
hatch remains visible, and how conflicts move from detection into review or
merge.
