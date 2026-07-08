# Milkdown Block Menu Chrome QA Finding

## Status

- Reported: 2026-07-08
- Reporter: Daniel
- Environment: Chrome desktop through the Tailscale MagicDNS Azurite URL
- Related slice: Slice 6 client persistence and navigation foundation
- Current disposition: Reproduce with browser QA before assigning root cause

## Context

Daniel reported an "iffy" editor interaction while testing Slice 6 against the
real knowledgebase on desktop Chrome. The behavior appeared while using this
route:

```text
http://macbook-air-von-daniel.taila0b671.ts.net:5173/?note=career_applications%2Fraw%2Fapplication_material%2Fdaniel-mulec-hofer-verkaufsmitarbeiter-alte-poststrasse-motivationsschreiben.md
```

The backend logs showed successful reads for this note and no save or server
errors. The frontend console did show repeated KaTeX/Milkdown-related warnings
about German characters being interpreted inside LaTeX/math mode. That may be a
separate issue, but it is relevant to the same editor reliability investigation.

## Observed Behavior

1. Open an existing note in Azurite.
2. Hover or select a Milkdown block so the left-side block controls appear.
3. Click the `+` control.
4. The block insert menu appears briefly.
5. The menu disappears almost immediately.
6. A new empty line or block is inserted.
7. Repeating the interaction creates multiple accidental empty lines.
8. Pressing Backspace removes some empty lines, but deletion intermittently
   stalls until waiting around 0.5 to 1 second.

## Expected Behavior

- Clicking the `+` control keeps the block insert menu open long enough to
  choose an action such as paragraph, heading, or another block type.
- The `+` control does not behave only like a blank-line insertion command.
- Backspace deletion across accidental empty blocks feels continuous and
  predictable.

## Initial Hypotheses

This should be treated as an integration finding until browser QA proves the
root cause. Possible causes include:

- Milkdown or Crepe default behavior that Azurite has not configured correctly.
- Focus loss when the block menu opens.
- A Milkdown selection reset after the `+` click.
- React remounting or re-rendering the editor surface at the wrong time.
- Zustand state updates feeding markdown back into Milkdown during an internal
  editor transaction.
- Dexie draft persistence timing interacting with editor callbacks.
- Math parsing warnings causing noisy editor updates for German prose.

## Verification Needed

Use browser QA in Chrome or the closest available browser automation surface.
The verification should capture both visual behavior and client-side state
events.

- Reproduce the `+` menu flash/disappear behavior on the reported note or a
  safe disposable copy with similar content.
- Capture frontend console output while reproducing.
- Inspect whether the editor component remounts, the editor session key changes,
  or selected note state changes during the interaction.
- Inspect whether Milkdown emits markdown updates on `+` menu open before a
  user chooses a block.
- Inspect whether Zustand marks the note dirty or writes a draft immediately
  after opening the menu.
- Inspect whether Dexie draft writes occur during repeated empty-line insertion
  and Backspace cleanup.
- Verify whether the KaTeX warnings come from content that should be plain text
  rather than math.

## Diagnostics Needed

Frontend diagnostics should be opt-in, for example with a query flag such as
`?debug=editor`, and should log structured timestamps around these boundaries:

- route note changes and validation results
- note load lifecycle events
- Milkdown mount, selection, transaction, and markdown update callbacks
- Zustand editor status transitions
- Dexie draft read, write, and delete attempts
- save attempts and conflict handling
- stale async responses that are ignored

For Sentry-backed debug sessions, diagnostics should capture uncensored editor,
state, request, replay, and backend context so the failure can be understood
from the Sentry session.

## Negative Side-Effect Guardrails For A Future Fix

- Existing note loading, URL-owned navigation, and browser history behavior must
  keep working.
- Existing unsaved draft recovery, missing-note draft recovery, and degraded
  recovery warnings must not regress.
- Existing save conflict protection must not weaken.
- Browser diagnostics must stay disabled by default and must not become a new
  source of truth for editor state.
- Editor fixes must not introduce silent content changes while opening menus,
  switching modes, saving, or recovering drafts.
