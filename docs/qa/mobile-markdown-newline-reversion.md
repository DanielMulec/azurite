# Mobile Markdown Newline Reversion QA Finding

## Status

- Reported: 2026-07-10
- Reporter: Daniel
- Environment: Pixel 6, Android Chrome, Tailscale MagicDNS Azurite URL
- QA context: deferred Slice 7A physical-phone and mobile-Replay verification
- Current disposition: required first product fix after Slice 7D; use Slice 7B
  correlation, Slice 7C Markdown authority, and Slice 7D semantic diagnostics
  to define the durable fix

## Context

Daniel tested Azurite against a disposable two-note cluster while Sentry debug
mode was explicitly enabled. Vite listened only on the Mac's current Tailscale
IPv4 address, Fastify remained on `127.0.0.1`, and the phone used the stable
MagicDNS origin.

The Slice 7A runtime proof passed: the phone sent deliberate web and server
events, the server response reported `sentry-trace=true` and `baggage=true`, and
Sentry showed a distinct live mobile Replay with the unmasked runtime marker.

## Observed Behavior

### WYSIWYG Mode

1. Daniel selected `technical-architecture.md` in the disposable cluster.
2. He inserted `PHONE-QA-SAVED-2026-07-10` near the top of the note through the
   WYSIWYG editor.
3. The current interaction remained "iffy" in the same general way as the
   existing Milkdown/Crepe QA finding, but the edit completed.
4. Manual save returned `200` from `PUT /api/notes/content`.
5. The marker was present in the saved markdown file and survived a later read.

### Markdown Source Mode

1. Daniel switched the same mobile editor to Markdown source mode.
2. He pressed Enter on the Android keyboard to create a new line.
3. The new line appeared briefly and was then reverted.
4. Repeating Enter produced the same result.
5. Because the controlled source value removed the new line, Daniel could not
   append the marker through Markdown mode.

### Draft-Recovery Observation

The first captured phone screen displayed `Recovered unsaved draft` for
`index.md` in the newly created disposable cluster. The session did not isolate
the exact navigation, reload, editor callback, or IndexedDB write that preceded
that state, so this remains an observation rather than a confirmed separate
defect. Slice 7D diagnostics should make the recovery transition explainable.

## Expected Behavior

- Pressing Enter in Markdown source mode creates a newline that remains in the
  controlled textarea value.
- Subsequent characters can be typed on the new line without the value being
  replaced by an older editor or store snapshot.
- Switching between WYSIWYG and Markdown preserves the same canonical markdown.
- Save, reload, and draft recovery preserve intentional edits without creating
  spurious recovered-draft state.
- Mobile editing remains predictable under Android keyboard and browser
  lifecycle behavior.

## Scope Decision

- This finding does not invalidate Slice 7A. Runtime delivery, tracing headers,
  Replay, the Vite proxy, and the local-only backend boundary all worked.
- Slice 7B does not fix the editor. It adds request and note-operation
  correlation so a mobile read or save can be followed across browser and
  Fastify evidence.
- Slice 7C fixes projection-only false dirty state and establishes the accepted
  source/WYSIWYG content-change boundary. Its physical-phone smoke does not test
  or accept Android source input.
- Slice 7D adds the Milkdown/Crepe, Markdown source, Zustand, and Dexie semantic
  evidence needed to determine why the newline and draft states change.
- The product fix is the required first delivery after Slice 7D. Its focused
  editor-correctness slice must use the 7A runtime, 7B correlation, 7C Markdown
  authority, and 7D semantic evidence to identify and repair the durable
  behavior boundary. No unrelated feature slice should intervene, and
  completing 7B, 7C, or 7D must not be reported as fixing this finding.

## Verification Needed

- Reproduce the source-mode Enter behavior on Android Chrome with a disposable
  note.
- Record the source textarea value before the keypress, immediately after the
  input event, and after the visible reversion.
- Correlate editor-mode changes, source updates, Milkdown lifecycle and markdown
  callbacks, Zustand editor revisions, and Dexie draft writes.
- Determine whether a parent-state update, editor reinitialization, stale
  callback, or another lifecycle transition replaces the source value. Treat
  these as investigation questions, not established causes.
- Reproduce or rule out recovered-draft state on a fresh cluster identity before
  any deliberate edit.

## Acceptance Boundary For A Future Fix

- Android Enter creates durable blank and non-blank source lines.
- Source text survives React rerenders, editor-mode switches, save, reload, and
  deliberate draft recovery.
- WYSIWYG and Markdown modes round-trip the same intended markdown.
- The fix covers desktop keyboard input and Android keyboard input without
  weakening content-hash conflict protection or draft durability.
- Automated tests cover the controlled-state boundary, and physical-phone QA
  confirms the behavior that browser automation cannot faithfully simulate.

## Negative Side-Effect Guardrails For A Future Fix

- Do not replace newer user input with an older Milkdown, Zustand, or Dexie
  snapshot.
- Do not weaken manual-save conflict detection or silently write recovered
  drafts to disk.
- Do not lose pending edits while switching modes, notes, routes, or browser
  lifecycle states.
- Keep markdown files canonical and browser persistence recovery-only.
- Keep Sentry optional and preserve Sentry-disabled editor behavior.
