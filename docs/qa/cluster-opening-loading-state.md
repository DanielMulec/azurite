# Cluster Opening Loading State QA Finding

## Status

- Reported: 2026-07-15
- Reporter: Daniel
- Repository commit:
  `b2218fe366929fd195cbfa969da25302e83f433b`
- Environment: development Vite session through the Tailscale MagicDNS origin,
  opening `/Users/danielmulec/knowledgebase`
- Current disposition: retain as input to a future frontend or Cluster opening
  workflow; do not annex it to Slice 7E or the post-7E editor-correctness gate

## Observed Behavior

Immediately after Azurite opened, the interface temporarily appeared to have no
usable cluster or notes. The sidebar showed the empty-state message and the main
surface showed that no note was selected. Several seconds later, the configured
cluster finished loading and its notes appeared normally.

The temporary state was convincing enough to suggest that Azurite had been
started without a cluster even though the backend was correctly configured for
the knowledgebase throughout the session.

## Reproduced Evidence

The initial Zustand state in
`apps/web/src/state/note-browser-store.ts` sets both `notesState` and `noteState`
to `idle`.

The current UI maps those states to definitive empty or unselected copy:

- `apps/web/src/components/NoteList.tsx` maps idle notes to
  `No markdown notes found in this cluster.`
- `apps/web/src/components/NoteEditorSurface.tsx` maps an idle note to
  `No note selected` and `Choose a note from the cluster list.`

The route workflow changes `notesState` to `loading` only after the initial
render begins. During the reported session, `GET /api/notes` returned `200` with
`362,474` bytes after approximately `4.84` seconds. The delay made the false
empty state visible as product truth rather than a negligible render flash.

## Product Interpretation

Cluster opening, genuinely empty discovery, and opening failure are different
product states. The initial interface currently collapses the pre-load state
into empty and unselected copy. This makes correct startup look misconfigured
and weakens confidence precisely when a large cluster takes longer to scan.

The visible-state correction and the underlying discovery performance are
separate concerns. A truthful opening state is required even when indexing later
makes discovery substantially faster.

## Expected Behavior

- The first committed UI state says that Azurite is opening or scanning the
  configured cluster.
- The interface declares a cluster empty only after note discovery completes
  successfully with zero notes.
- A failed opening or discovery request has distinct failure copy and retry
  behavior.
- A later notes refresh keeps any coherent rendered note visible while showing
  truthful background activity.
- Loading and failure status remain understandable on desktop, phone, and to
  assistive technology.

## Scope Decision

This is a user-facing quality finding for the future workflow that establishes
truthful Cluster opening and frontend loading behavior. It does not require a
new storage owner, cluster picker, derived index, or progress protocol by
itself. Those capabilities require their own product selection if the chosen
workflow needs them.

Slice 7E may measure the note-list lifecycle and discovery duration, but semantic
diagnostics do not own this UI correction. The post-7E editor-correctness gate
owns editor behavior and should not absorb cluster-opening presentation.

## Verification Needed

- Hold or delay the initial notes-list response and prove that the first visible
  state communicates cluster opening rather than emptiness.
- Return a successful empty list and prove that empty-cluster copy appears only
  after completion.
- Fail initial discovery and prove distinct failure and retry behavior.
- Return a non-empty list and prove normal URL selection and note loading.
- Cover development and optimized builds on desktop and Pixel 6.
- Confirm that the correction adds no duplicate list request, route transition,
  editor session, or browser-draft operation.

## Negative Side-Effect Guardrails For A Future Fix

- Do not clear or replace a coherent rendered note merely to show a later list
  refresh.
- Do not claim that a cluster is ready, empty, or unavailable before the owning
  request settles.
- Do not weaken URL selection, history, draft recovery, Save, conflict, or
  missing-note behavior.
- Do not turn loading presentation into another cluster, route, or note state
  authority.
