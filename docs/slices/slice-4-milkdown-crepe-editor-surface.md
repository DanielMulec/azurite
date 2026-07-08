# Slice 4: Milkdown And Crepe Editor Surface

## Status

Implemented.

This slice replaces the current read-only markdown viewer with a real editable
Milkdown and Crepe note surface. It proves Azurite's first WYSIWYG markdown
editing experience without writing edited notes back to disk yet.

## Product Decision

Use Milkdown with Crepe for the next editor implementation step.

Daniel selected the Milkdown Playground experience as the preferred direction.
The implementation should therefore target Crepe, not raw low-level Milkdown
alone.

The current `NoteViewer` concept should be replaced rather than kept as the
main selected-note surface. Azurite is moving from a read-only viewer to an
editable note surface.

## Goal

Given a selected markdown note, Azurite shows an editable Milkdown and Crepe
surface that:

- Loads raw markdown from the existing note-content API.
- Displays the note in WYSIWYG markdown mode by default.
- Allows local in-memory editing.
- Allows switching to plain markdown source mode.
- Can extract the current editor state back to markdown in memory.
- Discards local edits when switching notes or refreshing the page.
- Does not persist edited content to disk in this slice.

## Non-Goals

- Do not add a save API.
- Do not write edited markdown to disk.
- Do not add autosave.
- Do not add file conflict detection.
- Do not create, rename, move, delete, or duplicate notes.
- Do not add backlinks, graph behavior, search, indexing, or file watching.
- Do not add Tiptap, MDXEditor, or paid editor-template work.
- Do not redesign the whole application shell.

## Terms

- User-facing product language: cluster.
- Current implementation and API language: workspace.
- Selected note surface: the product area that replaces `NoteViewer`.
- Milkdown editor component: the small internal component that owns Crepe
  lifecycle details.

## Dependencies

Use the smallest dependency set needed to mount Crepe in the React web app.

Expected starting points:

- `@milkdown/crepe`
- `@milkdown/kit` for editor markdown utilities
- Crepe CSS required by the selected integration path

Do not add collaboration, upload, remote storage, or unrelated optional plugins
unless Crepe requires them for the default local editor experience.

## Design Rules

- The note body is editable by default.
- The first visible experience should feel like the Milkdown Playground/Crepe
  direction, then be gently fitted into Azurite's current shell.
- Add a small status line or similar quiet cue that editing is local-only in
  this slice.
- Do not show a save button yet.
- Do not implement custom HTML editing.
- Do not hide default Crepe affordances just because they include an HTML/code
  view. If Crepe exposes such a control by default, keep it for now and evaluate
  it during browser verification.
- Keep layout stable when notes load, switch, or enter source mode.
- Avoid nested card styling; the editor should feel like the main document
  surface.

## Implementation Plan

### 1. Install Editor Dependencies

Add the Milkdown and Crepe packages needed by `apps/web`.

Keep the install scoped to the web app. After installation, inspect the lockfile
diff and package graph for unexpected optional packages.

### 2. Replace The Viewer Concept

Replace `apps/web/src/components/NoteViewer.tsx` with a note-editor surface.

Recommended component shape:

```text
NoteEditorSurface
  handles idle/loading/error/ready note states
  renders selected note metadata
  renders MilkdownEditor for ready notes
```

The selected-note path should no longer render `SanitizedMarkdown`.

### 3. Isolate Crepe Lifecycle

Create a focused `MilkdownEditor` component that owns:

- Editor mount.
- Editor destroy/cleanup.
- Initial markdown load.
- Replacing editor content when the selected note changes.
- Current markdown extraction.
- Source-mode state if Crepe does not provide the desired source toggle
  directly.

Keep Crepe's imperative lifecycle out of the note-state component.

### 4. Wire Selected Notes

Pass the selected note's raw markdown into `MilkdownEditor`.

Use the selected note ID as the reset boundary. When the selected note changes:

- discard local edits from the previous note,
- initialize the editor with the new note's markdown,
- keep the note list selection and metadata correct.

### 5. Add Source Mode

Provide a plain markdown source mode.

The markdown shown in source mode must come from the current editor state, not
from stale original note content. Source mode edits are local-only in this slice
and must feed back into the editor state if the integration supports it
cleanly.

If Crepe already provides source-mode controls, prefer those controls over a
parallel custom source editor.

### 6. Add Local-Only Status

Add a quiet, honest UI cue for this slice, such as:

```text
Local editing only. Saving arrives in the next slice.
```

Do not add dirty/saved/error persistence states yet. Those belong with the save
API in Slice 5.

### 7. Remove Active Renderer Usage

Remove `SanitizedMarkdown` from the selected-note body path.

Keep existing markdown-renderer code and tests only if they are still useful as
documented legacy or fallback behavior. Delete or simplify them if they become
dead code after the editor surface lands.

### 8. Update Tests

Update web tests that currently assert read-only rendered markdown output.

Add coverage for:

- idle/loading/error/ready note-surface states,
- selected note metadata,
- editor surface mounting for ready notes,
- note switching reset behavior where practical,
- source-mode toggle behavior where practical,
- no save API calls or write behavior.

Mock Milkdown/Crepe in component tests if direct editor mounting is too heavy
for Vitest/jsdom. Use browser verification for real editor behavior.

### 9. Browser Verification

Run the app against a temporary cluster/workspace with representative markdown.

Verify:

- headings,
- paragraphs,
- emphasis,
- links,
- blockquotes,
- unordered and ordered lists,
- task lists,
- fenced code blocks,
- tables,
- horizontal rules,
- a large note,
- one representative note from the copied 555-note smoke corpus if available.

Also verify:

- WYSIWYG editing works locally.
- Source mode reflects current local edits.
- Switching notes discards unsaved local edits and loads the new note.
- Refreshing the page discards unsaved local edits.
- Existing loading, empty, and error states remain readable.
- Browser UI does not expose absolute filesystem paths.
- Any default Crepe HTML/code affordance is understandable enough to leave in
  place for this slice.

## Acceptance Criteria

- The selected note body is powered by Milkdown with Crepe.
- The old `NoteViewer` product concept is renamed or replaced.
- The current selected note opens as an editable WYSIWYG markdown surface.
- The user can switch to plain markdown source mode.
- Local edits are possible but are not written to disk.
- A quiet local-only editing cue is visible.
- Switching notes replaces editor content cleanly.
- Existing note list, selection, loading, empty, and error behavior still works.
- Existing read APIs remain unchanged.
- No save API or filesystem write behavior is added.
- `pnpm validate` passes.
- Browser verification passes with a temporary cluster/workspace.

## Implementation Notes

Implemented behavior:

- `NoteViewer` was replaced by `NoteEditorSurface`.
- The selected-note body now mounts a `MilkdownEditor` backed by
  `@milkdown/crepe`.
- The old `SanitizedMarkdown` and `markdown-renderer` selected-note path was
  removed.
- The active web dependencies now use `@milkdown/crepe` and `@milkdown/kit`.
- The note list exposes stable test hooks for browser verification while
  keeping product UI unchanged.
- The editor shows a quiet local-only cue and no save button.
- The source-mode toggle is implemented by Azurite using Crepe's
  `getMarkdown()` and Milkdown's `replaceAll()` utility.
- Local edits are intentionally discarded on refresh or note switch.
- User-facing empty/loading copy now says "cluster" while implementation APIs
  still use "workspace".

## Verification

Automated validation:

```bash
pnpm validate
git diff --check
```

Browser verification used a temporary cluster at
`/tmp/azurite-slice4-cluster` with headings, paragraphs, emphasis, links,
blockquotes, ordered lists, task lists, fenced code blocks, a table, and a
horizontal rule.

Verified in the in-app Browser at `http://127.0.0.1:5173/`:

- The page loaded with title `Azurite`.
- The selected note mounted a Milkdown/Crepe editor surface.
- The local-only editing cue was visible.
- The WYSIWYG and Markdown mode controls were visible.
- Markdown source mode showed current editor markdown.
- Editing source mode and switching back updated the WYSIWYG surface.
- Switching notes discarded the local unsaved edit and loaded the new note.
- Refreshing discarded local unsaved edits.
- Console warnings/errors were empty during the final browser checks.
- No absolute `/Users/daniel...` path appeared in the browser UI.
- Desktop and mobile-width screenshots showed the editor surface without a
  framework overlay or horizontal overflow.
- SHA-256 hashes for the temporary markdown files were unchanged after local
  browser editing, confirming this slice did not write to disk.

## Follow-Up Slice

Slice 5 should focus on safe manual markdown persistence.

The next slice is planned in
`docs/slices/slice-5-safe-manual-save-foundation.md`. It adds an explicit Save
action, content-hash conflict protection, atomic file writes, line-ending
handling, save-state UI, and note metadata refresh after save. Autosave remains
a follow-up policy slice so it can reuse the proven write path.

## Sources

- https://milkdown.dev/docs/recipes/react
- https://milkdown.dev/docs/guide/using-crepe
- https://milkdown.dev/docs/api/crepe
- https://github.com/Milkdown/examples
