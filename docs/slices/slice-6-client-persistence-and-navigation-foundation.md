# Slice 6: Client Persistence And Navigation Foundation

## Status

Proposed.

## Product Decision

Azurite needs a durable browser-side application state layer before adding more
editing workflows.

The product is a local-first PWA, not a stateless web page. Mobile QA after
Slice 5 showed that Android Chrome and Edge can reload or discard the Azurite
tab while Daniel switches apps. The current app then loses the selected note,
unsaved editor draft, and stale-save context because those values only exist in
React memory.

This slice establishes client persistence and URL-addressable navigation as a
product foundation:

- Canonical markdown remains on disk in the selected cluster.
- The URL owns addressable navigation state.
- Zustand owns live client and editor session state.
- Dexie owns durable browser persistence on IndexedDB.
- Browser persistence is recovery state, preferences, and future cache/outbox
  infrastructure. It is not the source of truth for notes.
- Slice 5 content-hash protection remains the authority for safe writes.

## User Story

When Daniel uses Azurite on desktop or phone, he can open a note, edit it, leave
or reload the browser, and return to the same note with any unsaved draft
protected. If the file changed on disk while the browser was away, Azurite keeps
the draft visible and prevents silent overwrite.

## Goals

Given a selected markdown note, Azurite can:

- encode the selected note in the browser URL,
- restore the selected note from the URL after reload,
- preserve unsaved editor drafts across reloads, mobile app switching, tab
  discard, and reconnects,
- scope browser-persisted state to the current cluster and note ID,
- detect when a recovered draft started from an older on-disk content hash,
- show a clear conflict/recovery state instead of silently overwriting or
  discarding content,
- let the user discard a recovered/conflicted draft and reload the disk version,
- clear durable draft state after a successful save,
- keep all saves flowing through `expectedContentHash`.

## Non-Goals

- Do not add new note creation.
- Do not add autosave-to-disk.
- Do not add merge UI.
- Do not add offline write queue behavior.
- Do not add search, backlinks, graph behavior, or note index caching.
- Do not make IndexedDB the canonical note store.
- Do not expose absolute filesystem paths to the browser.
- Do not solve authentication or multi-user access.

## Terms

- Addressable navigation state: state that belongs in the URL because reloads,
  browser history, sharing, and direct opening should preserve it.
- Live session state: in-memory UI and editor state needed for the current
  running app instance.
- Durable browser state: browser-persisted state that survives reloads and
  mobile tab discard.
- Draft: unsaved markdown the user has typed but has not saved to disk.
- Base content hash: the `contentHash` of the disk note the draft started from.
- Recovered draft: a draft restored from browser persistence after reloading.
- Draft conflict: a recovered draft whose base content hash no longer matches
  the current on-disk note hash.

## Package Decisions

Add these web dependencies:

- `@tanstack/react-router`
- `zustand`
- `dexie`

Add this web test dependency:

- `fake-indexeddb`

Use TanStack Router because URL state is becoming a typed product contract, not
an incidental query-string helper. The first route can stay simple, but it
should establish typed search-param validation for selected-note navigation.

Use Zustand because selected-note state, editor session state, save/conflict
state, and future UI state now cross component boundaries. Keeping them in
scattered `useState` hooks would create immediate refactor debt.

Use Dexie because Azurite needs a durable client database shape, not a few
string-keyed blobs. Drafts are the first table, but future durable browser state
can include UI preferences, recently opened notes, recovered conflicts, pending
write/outbox records, and rebuildable local caches. Dexie provides schema
versions, named tables, indexes, transactions, and a TypeScript-friendly API on
top of IndexedDB.

Use `fake-indexeddb` so Dexie behavior can be tested in Vitest without requiring
a real browser for every persistence assertion.

Keep Zod for runtime validation of any durable browser record before it affects
app state.

## Cluster Identity Decision

Browser-persisted state must be scoped by cluster.

The backend should provide a stable, non-path-leaking `clusterId` derived from
the configured workspace root. Use a versioned SHA-256 hash of the canonical
workspace path, such as:

```text
sha256("azurite-cluster-id-v1:" + realWorkspacePath)
```

The `clusterId` is not a secret and is not an authorization mechanism. It only
prevents browser state from one cluster or temporary QA workspace from being
applied to another cluster on the same origin.

Add the cluster identity to API responses that initialize or refresh the note
browser state. Prefer adding it to `GET /api/notes` and `GET /api/notes/content`
responses so the frontend can scope list state, selected-note state, and drafts
without exposing absolute paths.

## URL And Routing Decision

Use the URL as the source of truth for selected-note navigation.

Initial URL shape:

```text
/?note=Phone%20QA%2Fslice-5-conflict-test.md
```

The `note` search parameter contains the safe note ID already used by the API.
TanStack Router should validate the search shape and expose typed selected-note
navigation to React components.

Rules:

- Selecting a note updates the URL.
- Reloading the page restores the note from the URL.
- Browser back/forward changes the selected note.
- If no note appears in the URL, Azurite may select the first note as a startup
  convenience.
- If the URL references a missing note, Azurite shows a missing-note state
  instead of silently selecting the first note.
- The URL should not include absolute paths, cluster IDs, content hashes, or
  draft content.

## Client State Decision

Introduce a focused Zustand store for browser-session state.

The store should own:

- current cluster identity,
- notes list load state,
- selected note ID from typed router state,
- selected note load state,
- selected note content hash,
- editor markdown draft,
- saved markdown baseline,
- draft recovery state,
- save state,
- conflict state,
- editor mode if it affects recovery behavior.

The store should not own:

- canonical disk content outside the latest loaded note response,
- backend filesystem rules,
- API route constants,
- Dexie schema definitions,
- router implementation details beyond a small navigation adapter.

Keep API access in focused async actions or service functions. Avoid letting UI
components directly coordinate note loading, draft persistence, and router
updates.

## Durable Browser Database

Create a Dexie database for Azurite browser state.

Initial database:

```ts
type DraftRecord = {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly clusterId: string;
  readonly noteId: string;
  readonly baseContentHash: string;
  readonly markdown: string;
  readonly editorMode: "markdown" | "wysiwyg";
  readonly updatedAt: string;
};
```

Initial table:

```text
drafts: id, [clusterId+noteId], updatedAt
```

Draft record ID:

```text
draft:v1:<clusterId>:<noteId>
```

Validate loaded records with Zod before using them. If validation fails, ignore
the record and delete it when safe.

Do not store absolute filesystem paths. Do not store full note metadata unless
a future cache/index slice deliberately introduces it.

## Draft Persistence Behavior

Draft persistence must happen continuously enough that mobile unload events are
not the only safety net.

Rules:

- When editor markdown becomes dirty, persist a draft record for
  `clusterId + noteId`.
- Debounce routine draft writes enough to avoid excessive IndexedDB churn while
  still preserving mobile edits quickly.
- Flush any pending draft write on `visibilitychange` when the document becomes
  hidden.
- Flush any pending draft write on `pagehide`.
- Do not rely on `unload` for correctness.
- When the draft matches the saved markdown baseline, delete the durable draft.
- After successful save, update the saved baseline, update the content hash, and
  delete the durable draft.

## Reload And Recovery Behavior

When Azurite loads a selected note:

1. Fetch the current note from the server.
2. Load any durable draft for `clusterId + noteId`.
3. If no valid draft exists, show the server note normally.
4. If the draft's `baseContentHash` matches the server note's `contentHash`,
   restore the draft as unsaved changes.
5. If the draft's `baseContentHash` differs from the server note's
   `contentHash`, restore the draft as a recovered conflict.

Recovered conflict behavior:

- Keep the user's draft visible.
- Show a clear status such as `Recovered draft changed on disk`.
- Disable normal Save while in recovered conflict state.
- Offer `Reload disk version` to discard the durable draft and show the current
  server note.
- Do not overwrite the file.
- Do not attempt automatic merge.

Runtime save conflict behavior should use the same recovery path:

- Keep the user's draft visible.
- Persist the conflicted draft.
- Show `Changed on disk`.
- Offer `Reload disk version`.

## Backend And Shared Contract Plan

### 1. Add Cluster Identity

In `packages/core`, add a helper that derives `clusterId` from the resolved
workspace root without exposing the path.

### 2. Extend Shared Schemas

In `packages/shared`, add a `clusterSchema` and include cluster identity in note
list and note content responses.

### 3. Extend Server Responses

In `apps/server`, include the cluster identity in:

- `GET /api/notes`
- `GET /api/notes/content`
- `PUT /api/notes/content`

Successful save responses should keep the same cluster identity so the frontend
can update state and clear drafts using the same namespace.

## Frontend Plan

### 1. Install Client State Dependencies

Add TanStack Router, Zustand, Dexie, and fake IndexedDB test support.

Keep dependency changes scoped to `apps/web` unless a package needs shared types
or contracts.

### 2. Create Router Boundary

Add a small router setup that renders the current `App` shell and validates the
`note` search parameter.

Update the Vite/React entrypoint to mount through the router provider.

### 3. Create Client Store Boundary

Move selected note loading, note list loading, save state, conflict state, and
editor draft state behind a Zustand store.

The store should expose small actions:

- `loadNotes`
- `selectNote`
- `loadSelectedNote`
- `updateDraftMarkdown`
- `saveSelectedNote`
- `reloadDiskVersion`
- `restoreRecoveredDraft`

Avoid a single giant action that does all browser behavior at once.

### 4. Create Dexie Persistence Module

Add a dedicated module for:

- opening the Azurite browser database,
- reading drafts,
- writing drafts,
- deleting drafts,
- validating draft records,
- clearing invalid records.

UI components should not call Dexie directly.

### 5. Restore Selected Note From URL

When notes load, use the router's selected note ID when present.

If the URL note exists, select and load it.

If the URL note is missing, show a missing-note state.

If the URL has no note and notes exist, select the first note and update the URL
so the chosen state becomes addressable.

### 6. Restore Drafts After Note Load

After loading a selected note, ask the persistence module for a matching draft.

Use the reload and recovery behavior rules above to decide whether to show the
server note, an unsaved draft, or a recovered conflict.

### 7. Persist Drafts During Editing

When Milkdown or source mode reports markdown changes, update Zustand state and
schedule draft persistence through the persistence module.

Flush pending draft writes on mobile lifecycle events.

### 8. Save And Clear Drafts

On save:

- send `expectedContentHash` from the draft's base content hash,
- keep using the Slice 5 API contract,
- on success, update baseline/hash and clear the durable draft,
- on `note_write_conflict`, persist the draft and show conflict state.

### 9. Add Recovery UI

Extend the save toolbar or selected-note header to show recovery states without
turning the editor into a modal.

Required controls:

- Save for normal dirty drafts.
- Reload disk version for recovered/runtime conflicts.

Optional if small and reliable:

- A timestamp showing when the draft was recovered.

Do not add merge UI in this slice.

## Tests

Add focused tests at each boundary.

Shared/core/server tests:

- cluster IDs are deterministic for the same canonical workspace path,
- cluster IDs do not include the raw workspace path,
- note list responses include cluster identity,
- note content read responses include cluster identity,
- save responses include cluster identity.

Router tests:

- selected note is parsed from `?note=...`,
- selecting a note updates the URL,
- back/forward navigation changes selected note state,
- missing URL note shows a missing-note state.

Store tests:

- notes load into the store with cluster identity,
- selected note loads from router state,
- editing markdown creates dirty draft state,
- save success clears dirty state and durable draft state,
- save conflict preserves the draft and enters conflict state,
- reload disk version clears the draft and restores server content.

Persistence tests:

- valid draft records save and load,
- invalid draft records are rejected,
- drafts are scoped by `clusterId + noteId`,
- clearing one draft does not clear another cluster's draft,
- schema version is required.

Component/app tests:

- reload/remount restores selected note from URL,
- reload/remount restores an unsaved draft,
- reload/remount detects a changed-on-disk recovered draft,
- recovered conflict shows the draft and a reload-disk action,
- successful save clears the recovered draft.

## Browser Verification

Use a temporary cluster, not Daniel's real knowledgebase.

Verify on desktop browser:

- selecting a note updates the URL,
- reloading restores the same selected note,
- unsaved markdown source edits survive reload,
- unsaved WYSIWYG edits survive reload,
- saving a recovered draft clears it from IndexedDB,
- missing-note URL shows the missing-note state.

Verify through Tailscale on Android Chrome or Edge:

- selected note survives reload,
- selected note survives app switching when the browser reloads,
- unsaved edit survives app switching and reload,
- delayed external disk edit plus recovered draft shows conflict state,
- `Reload disk version` clears the recovered draft and shows disk content.

## Acceptance Criteria

- The selected note is encoded in the URL.
- Reloading the page restores the same selected note.
- Missing URL notes show an explicit missing-note state.
- Zustand owns the note browser and editor session state.
- Dexie owns durable browser draft persistence.
- Drafts are scoped by cluster ID and note ID.
- Browser storage never exposes absolute filesystem paths.
- Unsaved markdown and WYSIWYG edits recover after reload.
- Recovered drafts keep their original base content hash.
- Disk changes during browser sleep become a recovered conflict, not overwrite.
- Runtime save conflicts persist the draft and expose a recovery path.
- Successful saves clear durable draft records.
- `pnpm validate` passes.
- Browser QA passes on desktop and Android over Tailscale.

## Follow-Up Slices

After this foundation is implemented, add new markdown note creation.

The creation slice should reuse the router, Zustand store, Dexie persistence,
and cluster identity introduced here. It should decide the first creation
location, filename validation, duplicate filename handling, title behavior,
optional folder creation, list refresh, URL update, draft initialization, and
auto-selection after creation.

Recoverable delete or move-to-trash should follow creation.

Autosave should be a later separately numbered slice after manual save,
creation, recoverable delete, and this client persistence foundation are stable.

Autosave should reuse the durable draft/outbox direction instead of introducing
a separate persistence model.
