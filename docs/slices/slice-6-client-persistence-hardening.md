# Slice 6 Client Persistence Hardening

## Status

P1 and P3 adversarial review fixes implemented and locally verified.

This is not a new product slice. It finishes the acceptance bar for
`slice-6-client-persistence-and-navigation-foundation.md` before Daniel starts
desktop QA and Android/Tailscale QA with real notes.

The main hardening implementation and the P1/P3 adversarial review corrections
are implemented in the current codebase. Daniel's desktop QA and
Android/Tailscale QA with real notes remain the final product verification pass
before moving to the next slice.

## Required Implementation Context

Implementers must use this document together with
`docs/slices/slice-6-client-persistence-and-navigation-foundation.md`.

The adversarial review findings below are not enough by themselves. They name
the current gaps, but the original Slice 6 foundation document and the
guardrails in this hardening document define the behavior that must not regress:
manual save safety, missing-note recovery, stale async guards, durable draft
preservation, degraded recovery visibility, URL/history behavior, and shared
note-ID validation.

## Adversarial Review Findings Before Completion

Status: Fixed locally and kept as regression reference.

These findings were the blocking adversarial review gaps. Keep the scenarios
below covered by tests and browser smoke so future changes do not reopen them.

### P1: Stale Missing-Note Draft Recovery

A slow missing-note draft lookup can overwrite a newer selected note.

Current risk:

- `applyMissingNoteDraft` awaits draft recovery and then sets `selectedNoteId`
  and `noteState` without confirming that the missing note is still the current
  selected route intent.
- Normal note reads use request/current-note guards, but the missing-note draft
  path does not currently have the same post-await protection.
- Reproduction: start route sync to `missing.md`, delay the draft lookup, select
  `Projects/azurite.md`, then resolve the stale missing-note lookup. The store
  returns from `Projects/azurite.md` ready state to `missing.md` missing state.

Required fix:

- Give missing-note draft recovery the same stale-request discipline as normal
  note loads.
- Start missing-note recovery through a request ID or equivalent current-route
  guard before awaiting browser draft persistence.
- After the draft lookup resolves, verify the missing note is still the current
  selected route intent before setting `missing` or `missing-draft`.
- Apply the same guarded path to missing notes discovered from an explicit URL
  route and to `404 note_not_found` responses from selected-note reads.
- Do not let stale draft read failures degrade the currently selected note
  session after Daniel has already moved on.

Required tests:

- A slow missing-note draft lookup cannot overwrite a newer selected real note.
- A missing URL note still shows `Note not found` when no draft exists.
- A missing URL note with a matching draft still shows `missing-draft`.
- A stale missing-note draft read failure cannot put the current note into a
  fake degraded, conflict, failed-save, loading, missing, or missing-draft state.

### P3: Route Decoding Edge Case

Route note decoding can reject valid safe note IDs that contain literal percent
characters.

Current risk:

- The router parser unconditionally runs `decodeURIComponent` on the note search
  value it receives.
- If the router has already normalized the search value, a valid note ID such as
  `100%.md` can throw during decoding and be dropped even though the shared
  `noteIdSchema` allows it.
- The encoded traversal fix must keep rejecting unsafe encoded paths without
  double-decoding or rejecting safe filenames.

Required fix:

- Keep URL decoding at one canonical route boundary.
- Validate the decoded note ID with `noteIdSchema` exactly once.
- Do not call `decodeURIComponent` on arbitrary route strings that may already
  be decoded.
- Keep encoded traversal such as `..%2Fsecret.md` invalid.
- Preserve valid literal percent filenames such as `100%.md`.
- Preserve filenames that contain encoded-looking text literally, such as a
  safe note ID whose filename includes `%2F`, without turning it into a path
  separator.

Required tests:

- `?note=..%2Fsecret.md` is dropped and cannot become a missing-note draft key.
- `?note=100%25.md` resolves to `100%.md`.
- A literal encoded-looking filename serialized as `foo%252Fbar.md` stays a
  literal `foo%2Fbar.md` note ID and does not become `foo/bar.md`.
- Startup replace, user-selection push, and browser back/forward behavior still
  pass after the parser change.

## Product Decision

Finish Slice 6 by making URL state, draft recovery, and save races dependable
under adverse timing.

Azurite should not only pass normal "click slowly" QA. It must preserve the
newest user intent when saves, route changes, note selections, and browser
recovery overlap.

## User Story

When Daniel opens Azurite, selects notes quickly, edits while a save is in
flight, or changes route state during startup, Azurite keeps the selected note,
URL, and durable draft state aligned with his latest action. If draft recovery
is degraded, the app tells him even when no editor is currently mounted.

## Findings To Fix

- In-flight save responses can overwrite newer same-note edits and clear the
  durable draft.
- Rapid note clicks can push a stale URL after the store has already ignored the
  stale note load.
- Route changes during initial note-list loading can be lost because the first
  captured route note is reused after the list resolves.
- URL note validation and draft `noteId` validation are looser than the shared
  safe note-ID contract.
- Degraded draft-recovery status only appears in the ready editor toolbar and is
  hidden for missing, idle, loading, and error note states.
- Router/history automated coverage is thinner than the Slice 6 plan requires.

## Implementation Plan

### 1. Share Safe Note-ID Validation

Export a reusable safe note-ID schema from `packages/shared/src/notes.ts`.

Implementation requirements:

- Create a `noteIdSchema` that owns the existing safe note-ID validation rules.
- Build `noteIdInputSchema` from `noteIdSchema` instead of duplicating rules.
- Use `noteIdSchema` in `apps/web/src/app-router.tsx` for `?note=`.
- Use `noteIdSchema` in `apps/web/src/persistence/draft-records.ts` for draft
  `noteId`.
- Drop invalid route notes from parsed search state.
- Delete invalid current-version draft records as validation failures.
- Preserve unknown future-version draft records exactly as Slice 6 already
  requires.

### 2. Guard In-Flight Saves Against Newer Edits

Add a same-note editor session guard so save responses only affect the editor
snapshot that initiated the save.

Implementation requirements:

- Guard save success, save failure, and save conflict paths by note ID plus
  editor session key or a dedicated editor revision.
- If Daniel keeps typing while Save is in flight, the returning save response
  must not replace the newer markdown.
- A successful stale save response should advance the saved baseline and content
  hash from the server response without replacing the newer current markdown,
  leaving the editor dirty against the new baseline.
- A save response for an older editor snapshot must not delete the newer durable
  draft.
- A save failure for an older editor snapshot must not mark the newer editor
  state as failed.
- A save conflict must persist the latest current draft for the selected note,
  not an older save snapshot.

### 3. Prevent Stale URL Pushes After Rapid Note Selection

Move user note-selection URL updates behind confirmed current store state.

Implementation requirements:

- After an awaited note selection, push the URL only when the store's current
  selected note still matches the requested note.
- Avoid relying on a React selector value captured before the async selection.
- Rapidly selecting note B and then note C must leave both UI state and URL on
  note C.
- A stale note B load may be ignored without pushing `?note=B`.

### 4. Preserve Latest Route While Notes Load

Track the latest route note while `/api/notes` is loading and synchronize from
that latest value once notes are ready.

Implementation requirements:

- Do not let `loadNotes` permanently capture the route note from its first
  render.
- If the route changes before note summaries finish loading, the resolved note
  list must sync against the latest route note.
- Route synchronization should remain a small adapter boundary; do not move
  router internals into filesystem, API, or Dexie modules.

### 5. Show Degraded Recovery Outside The Ready Editor

Move the degraded draft-recovery banner to a note-surface level where every note
state can display it.

Implementation requirements:

- Render degraded recovery status in `NoteEditorSurface` before the ready,
  missing, missing-draft, idle, loading, and error state bodies.
- Avoid duplicate banners in the ready editor toolbar.
- Missing note plus unavailable cluster identity must show both the missing-note
  state and the draft-recovery degradation message.
- Manual save must remain usable when the editor is ready and cluster identity
  or browser persistence is degraded.

### 6. Strengthen Router And History Tests

Add automated coverage for the route behaviors the Slice 6 plan names.

Required tests:

- Invalid `?note=` values are dropped from parsed route search state.
- Startup auto-selection uses history replace.
- User note selection uses history push.
- Browser back/forward changes the selected note.
- Route changes during note-list loading use the latest route note.
- Rapid note selection does not push a stale URL.

### 7. Add Save-Race Regression Tests

Add store-level tests that prove newer editor intent wins over older save
responses.

Required tests:

- A save response resolving after a newer same-note edit does not overwrite that
  edit.
- A save response resolving after a newer same-note edit does not delete the
  newer durable draft.
- A save failure resolving after a newer same-note edit does not mark the newer
  edit failed.
- A save conflict persists the latest current draft for the selected note.

## Negative Side-Effect Guardrails

These fixes must preserve existing Slice 5 and Slice 6 behavior while closing
the identified gaps.

Implementation requirements:

- Preserve the Slice 5 manual save contract: every disk write still sends
  `expectedContentHash`, and runtime disk conflicts still return to the existing
  conflict recovery path.
- Preserve note-switch draft flushing while changing URL push behavior.
- Preserve desktop and mobile reload recovery for selected notes, unsaved
  drafts, recovered conflicts, and missing-note drafts.
- Preserve unknown future draft schema versions. Validation hardening must not
  delete records created by a newer Azurite build.
- Do not delete existing valid current-version drafts when adding shared
  note-ID validation.
- Invalid `?note=` values must not create Dexie records, expose absolute paths,
  or become missing-note draft keys.
- Successful stale save responses must advance the saved baseline and content
  hash without replacing newer current markdown or clearing the newer durable
  draft.
- Ignored stale save, read, or route responses must not leave the app in a fake
  conflict, failed-save, or loading state.
- Moving the degraded recovery banner must not duplicate the banner in ready
  editor state.
- Router changes must preserve browser back/forward behavior after startup
  replace and user-selection push.

## Verification Plan

Run the full repository validation:

```sh
/opt/homebrew/bin/pnpm validate
```

Then run a targeted desktop browser smoke test against a temporary cluster, not
Daniel's real knowledgebase:

- load a route-selected note,
- rapidly switch notes and confirm URL/UI alignment,
- edit while a save is in flight and confirm newer text survives,
- reload and confirm the newer draft recovers,
- simulate a missing note with unavailable draft recovery and confirm both
  states are visible.

Android/Tailscale QA remains Daniel's physical-device pass after this hardening
is complete.

## Acceptance Criteria

- No stale save response can overwrite newer same-note edits.
- No stale save response can delete a newer durable draft.
- Successful stale save responses advance the saved baseline and content hash
  without replacing newer current markdown.
- Save failure and save conflict paths are guarded against newer same-note
  editor state.
- Rapid note clicks cannot desynchronize the URL from the selected note.
- Route changes during initial note-list loading are honored.
- URL note IDs and current-version draft note IDs use the shared safe note-ID
  contract.
- Degraded draft recovery is visible even when no ready editor is mounted.
- Router/history behavior has automated coverage for replace, push,
  back/forward, stale route, and stale selection cases.
- Save-race behavior has automated regression coverage.
- Existing manual save, conflict recovery, note-switch draft flushing, reload
  recovery, missing-note draft recovery, and future draft schema preservation
  still pass.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.
