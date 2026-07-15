# Product Guardrails

## Purpose

These are Azurite's baseline preservation guarantees. Every product slice must
keep them true unless the slice explicitly changes one as a reviewed product
decision.

Slice documents should link to this page and list only the additional
slice-specific regression risks. Do not copy this entire catalog into every
proposal.

## Canonical Knowledge And Persistence

- Markdown files in the selected cluster remain the canonical knowledge source.
- Browser storage, indexes, caches, telemetry, and UI state do not become a
  second canonical note store.
- Existing-note writes use the shared content-hash conflict contract and must
  not silently overwrite a newer disk version.
- Unsaved drafts remain scoped by cluster ID and note ID, survive supported
  recovery flows, and clear only after an intentional discard or successful
  save.
- Unknown future browser-persistence schema versions are preserved rather than
  deleted by an older build.

## Identity, Navigation, And State

- Note IDs use the shared validation contract and never expose absolute
  filesystem paths to the browser.
- URL-owned note selection, startup replacement, user-navigation pushes, and
  browser back/forward behavior remain coherent.
- Stale asynchronous work cannot replace newer route, selection, editor, draft,
  or save intent.
- Degraded, missing-note, conflict, failed-save, and recovery states remain
  visible instead of silently falling back to a misleading ready state.

## Validation And Security

- Filesystem reads and writes remain inside the configured cluster boundary;
  path traversal, ignored directories, and unsafe symlink escapes remain
  rejected.
- Shared request, response, route, and error contracts remain the authority
  across frontend and backend code.
- User-facing errors do not expose private absolute filesystem paths.
- The backend remains local-only when the frontend can proxy phone or Tailscale
  requests.
- Credentials, authorization headers, session cookies, API keys, auth tokens,
  DSNs, and secret environment values are never deliberately captured in
  telemetry or committed to Git. Explicit Sentry debug mode may capture complete
  Azurite product data, including markdown, drafts, paths, state, and request
  payloads; credential containment still applies.

## Product Ownership

- The URL owns addressable navigation state.
- Zustand owns live note-browser and editor-session state.
- Dexie owns durable browser recovery state.
- Sentry owns development observability, not product state or recovery.
- `packages/core` owns filesystem-backed knowledge behavior and remains
  independent of frontend frameworks and observability SDKs.

## Verification Baseline

- `/opt/homebrew/bin/pnpm validate` passes.
- Tests cover the new behavior and the existing guarantees the change touches.
- Browser or device QA is performed when behavior depends on real rendering,
  editor integration, browser lifecycle, history, storage, Tailscale, or mobile
  behavior.
- Implemented Sentry delivery, semantic evidence, request correlation, tracing,
  Replay, fail-open behavior, and instrumented workflows remain operational when
  a change touches their emitters, context sources, correlated request paths,
  runtime adapters, or lifecycle boundaries.
- After successful delivery, the primary repository is clean on `main`, all
  temporary worker worktrees and branches are removed, and the complete state
  is synchronized with `origin/main`.
