# Proposed Slice: End-To-End Sentry Observability Foundation

## Status

Proposed for adversarial review.

This proposal intentionally avoids claiming the `Slice 7` number yet. Existing
project docs currently name note creation as Slice 7. If this proposal is
accepted as the next implementation slice, the slice ordering should be updated
deliberately so the roadmap stays coherent.

## Product Decision

Azurite adopts Sentry as the observability backbone for the current local web
app and local Fastify API runtime.

Sentry owns the durable observability platform role: event capture, structured
logs, session replay, error grouping, trace correlation, and investigation UI.
Azurite owns a thin semantic instrumentation layer that explains product events
such as note routing, editor updates, draft persistence, save conflicts, and
filesystem-backed note operations.

This settles that Azurite will not hand-roll a custom logging/replay system for
development debugging when a mature observability platform can own that future
product capability.

## User Story

As Daniel testing real notes on desktop Chrome or mobile over Tailscale, when
Azurite feels wrong, we can inspect the real session path in Sentry:

- browser session replay
- frontend errors, logs, breadcrumbs, and traces
- frontend API request breadcrumbs
- backend Fastify request/error telemetry
- backend structured logs for note list/read/save behavior
- Azurite-specific breadcrumbs for routing, Milkdown, Zustand, Dexie, save,
  conflict, recovery, and cluster metadata behavior

## Why This Matters

Slice 6 made Azurite meaningfully testable, but the most important current
failure modes are under-instrumented. Backend logs show request success or
failure, and Vite shows incidental browser warnings, but neither explains the
full editor and persistence path.

The Milkdown block-menu QA finding shows the gap clearly: a visual editor issue
may involve Milkdown focus, React render timing, Zustand state transitions,
Dexie draft writes, frontend fetches, and backend note state. Azurite needs a
single investigation surface that can correlate those events across the current
runtime.

## Goals

- Create Sentry coverage for the current `apps/web` React browser surface.
- Create Sentry coverage for the current `apps/server` Fastify API surface.
- Verify that real desktop and mobile/Tailscale Azurite sessions reach Sentry.
- Capture frontend session replay for editor QA.
- Capture frontend logs, errors, breadcrumbs, and traces.
- Capture backend Fastify errors, request telemetry, structured logs, and
  note-operation breadcrumbs.
- Propagate trace context across frontend `/api/*` calls into the backend where
  Sentry supports it.
- Establish shared event names and rich diagnostic attributes for Azurite
  observability.
- Keep Azurite fully functional when Sentry env vars are missing.

## Non-Goals

- Fixing the Milkdown block-menu bug in this slice.
- Adding Sentry to future mobile-native, desktop-native, worker, sync, or
  indexing surfaces that do not exist yet.
- Creating a public production telemetry policy.
- Creating a custom in-app log viewer.
- Persisting observability events as Azurite product state.
- Replacing existing Fastify logs with Sentry.
- Adding payment information, paid Sentry features, or billing-dependent
  behavior.

## Existing Sentry State

- Organization/workspace: `Daniel Mulec`
- Web project: `azurite-web`
- Web platform: React
- Web project URL:
  `https://daniel-mulec.sentry.io/projects/azurite-web/getting-started/`

The backend project still needs to be created:

- Backend project: `azurite-server`
- Backend platform: Fastify or Node.js, following Sentry's official Fastify
  guidance.

## Architecture

### Sentry Projects

Use two Sentry projects:

- `azurite-web` for React browser telemetry.
- `azurite-server` for Fastify API telemetry.

This split matches Azurite's current runtime boundary and Sentry's project
model. Browser/editor problems and backend/filesystem problems should be
grouped separately while still being correlatable through trace IDs, request
metadata, note IDs, release, and environment.

### Configuration Boundary

Sentry must be configured through local environment variables:

Web:

- `VITE_SENTRY_ENABLED`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`

Server:

- `SENTRY_ENABLED`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`

Example values belong in committed environment docs. Real DSNs, auth tokens, and
project credentials must stay out of Git.

### Source Maps And Release Metadata

The integration should support readable TypeScript stack traces. The first
implementation should add release naming and preserve normal local source maps.
Production-like source-map upload should be gated behind explicit Sentry auth
configuration so local development does not require a Sentry auth token.

### Instrumentation Boundary

Direct Sentry calls should stay behind small observability modules instead of
being scattered through feature code.

Expected modules:

- web Sentry initialization
- web Azurite breadcrumb/log helpers
- server Sentry initialization
- server Azurite breadcrumb/log helpers
- shared event-name constants if both sides use the same vocabulary

Sentry debug mode is intentionally uncensored. Instrumentation may send rich
diagnostic context when Sentry is explicitly enabled, but it must not own
product decisions, editor state, draft state, or save behavior.

## Implementation Plan

### 1. Create The Backend Sentry Project

Create `azurite-server` in the existing `Daniel Mulec` Sentry workspace.

Project setup requirements:

- Use Sentry's official Fastify or Node.js setup path.
- Keep the new Sentry setup page available long enough to copy the backend DSN
  into Daniel's local environment.
- Do not commit the backend DSN.

### 2. Add Dependencies

Add Sentry packages to the owning workspaces:

- `@sentry/react` in `apps/web`
- `@sentry/node` in `apps/server`

Add a Sentry Vite/source-map package only when the implementation uses it for
release/source-map support. If it is added, document that it is a build-time
observability dependency, not product runtime state.

### 3. Add Environment Documentation

Add committed environment examples without secrets.

The docs must show:

- how to enable/disable Sentry locally
- which variables are required for web telemetry
- which variables are required for server telemetry
- that Azurite remains runnable without Sentry
- that real DSNs and auth tokens stay in untracked local env files

### 4. Initialize Web Sentry

Initialize Sentry before the React app renders.

Web requirements:

- Initialize only when `VITE_SENTRY_ENABLED` and `VITE_SENTRY_DSN` allow it.
- Tag events with `app.surface = web`.
- Set `environment` and `release` from env/config.
- Enable React/browser error capture.
- Enable browser console/log capture.
- Enable Session Replay for development QA.
- Enable browser tracing.
- Propagate tracing headers to Azurite API requests where Sentry supports it.
- Add a React error boundary around the app shell or editor surface without
  changing normal UI behavior.

### 5. Initialize Server Sentry

Initialize Sentry before Fastify routes and plugins are registered.

Server requirements:

- Initialize only when `SENTRY_ENABLED` and `SENTRY_DSN` allow it.
- Tag events with `app.surface = server`.
- Set `environment` and `release` from env/config.
- Enable Sentry's Fastify integration.
- Enable backend structured logs where supported.
- Keep existing Fastify/Pino logging intact.
- Capture unhandled backend errors.
- Capture route/request errors without weakening existing error responses.

### 6. Add Frontend Semantic Observability

Add rich breadcrumbs/logs for the current editor workflow.

Frontend events:

- `route.note.changed`
- `route.note.invalid`
- `note.load.started`
- `note.load.succeeded`
- `note.load.failed`
- `note.load.stale_ignored`
- `editor.milkdown.mounted`
- `editor.milkdown.markdown_updated`
- `editor.mode.changed`
- `editor.status.changed`
- `draft.read.started`
- `draft.read.succeeded`
- `draft.read.failed`
- `draft.write.started`
- `draft.write.succeeded`
- `draft.write.failed`
- `draft.delete.started`
- `draft.delete.succeeded`
- `save.started`
- `save.succeeded`
- `save.conflicted`
- `save.failed`
- `recovery.draft.visible`
- `recovery.degraded.visible`

Frontend diagnostic attributes may include:

- note ID
- full markdown content
- selected text and editor context
- editor mode
- editor status
- markdown length and full markdown snapshots
- content hash values already used by the save API
- draft presence booleans
- full IndexedDB draft payloads
- Zustand state snapshots
- Milkdown/ProseMirror transaction context where available
- request IDs or editor session IDs
- route source such as direct URL, list click, browser history, or fallback
- request and response payload context

### 7. Add Backend Semantic Observability

Add rich breadcrumbs/logs for note and cluster operations.

Backend events:

- `workspace.notes.list.started`
- `workspace.notes.list.succeeded`
- `workspace.notes.list.failed`
- `note.read.started`
- `note.read.succeeded`
- `note.read.not_found`
- `note.read.invalid`
- `note.save.started`
- `note.save.succeeded`
- `note.save.conflicted`
- `note.save.invalid`
- `note.save.failed`
- `cluster.metadata.read.succeeded`
- `cluster.metadata.created`
- `cluster.metadata.failed`
- `security.note_id.rejected`
- `filesystem.boundary.rejected`

Backend diagnostic attributes may include:

- note ID
- workspace/cluster ID
- resolved local filesystem paths
- operation duration
- result status
- API error code
- HTTP method and route pattern
- content hash values already returned by the API
- request and response payload context
- filesystem error details
- stack traces and local temporary file paths
- full markdown content when it helps diagnose read/write behavior

### 8. Add Deliberate Test Events

Add development-only ways to prove telemetry works without throwing accidental
real product errors.

Requirements:

- Web test event can be triggered only in development or explicit debug mode.
- Server test event can be triggered only in development or explicit debug mode.
- Test events are impossible to trigger accidentally in normal user workflows.
- Test events do not write notes or mutate cluster metadata.

### 9. Verify With Real Runtime

Run automated validation and then verify through Sentry UI.

Required QA:

- local desktop browser sends a web test event to `azurite-web`
- local backend sends a server test event to `azurite-server`
- loading a real note creates frontend and backend observability breadcrumbs
- saving a disposable note creates frontend and backend save breadcrumbs
- a forced or real conflict creates frontend and backend conflict evidence
- mobile/Tailscale browser session appears as a distinct web session
- the Milkdown block-menu reproduction attempt creates replay and editor
  breadcrumbs useful enough to guide the follow-up fix slice

## Runtime Requirements

This slice must preserve existing product behavior while adding observability.

- Azurite must run normally with no Sentry env vars.
- No real DSNs, Sentry auth tokens, or organization credentials are committed.
- Existing note loading behavior must not change.
- Existing URL-owned navigation and browser history behavior must not change.
- Existing manual save and content-hash conflict behavior must not change.
- Existing Dexie draft persistence and recovery behavior must not change.
- Existing missing-note and degraded recovery states must remain visible.
- Existing validation and filesystem boundary protections must not weaken.
- Existing Fastify error response shapes and shared API error codes must not
  change unless a test and reference-doc update explicitly covers the change.
- Existing local hosting rule remains true: backend is local-only when the
  frontend can proxy API requests for Tailscale/phone QA.
- Sentry instrumentation must not introduce a new source of truth for editor,
  draft, route, save, cluster, or note state.
- Session Replay must be configured so it is useful for editor QA.
- Telemetry volume must be controlled enough that normal editing remains usable
  and Sentry remains inspectable.
- Telemetry should be complete enough to debug real failures across the
  browser, editor, client state, IndexedDB, API, Fastify, and filesystem path.

## Verification Plan

Run the full repository validation:

```sh
/opt/homebrew/bin/pnpm validate
```

Run targeted automated tests for:

- Sentry-disabled web initialization
- Sentry-enabled web initialization with mocked SDK calls
- Sentry-disabled server initialization
- Sentry-enabled server initialization with mocked SDK calls
- frontend observability helpers preserving rich diagnostic payloads
- backend observability helpers preserving rich diagnostic payloads
- existing route, draft, save, conflict, and recovery tests

Run manual/browser QA:

- Start Azurite locally with web and server Sentry env vars.
- Open the Tailscale MagicDNS URL on desktop Chrome.
- Trigger the web development test event and confirm it reaches `azurite-web`.
- Trigger the server development test event and confirm it reaches
  `azurite-server`.
- Load the note from the Milkdown block-menu bug report.
- Confirm Sentry captures the browser session, console warnings, API request
  path, note-load breadcrumbs, and backend note-read evidence.
- Reproduce or attempt to reproduce the Milkdown `+` block-menu behavior.
- Confirm Sentry contains enough replay and breadcrumb evidence to decide the
  next fix slice.
- Open the same MagicDNS URL on mobile.
- Confirm mobile appears as a distinct Sentry web session.

## Acceptance Criteria

- `azurite-web` receives real telemetry from desktop Azurite.
- `azurite-web` receives real telemetry from mobile/Tailscale Azurite.
- `azurite-server` receives real telemetry from the local Fastify API.
- Frontend and backend events include shared release/environment metadata.
- Frontend API calls and backend requests are correlatable where Sentry
  supports trace propagation.
- The Milkdown block-menu bug report can be investigated with Sentry evidence
  instead of only terminal logs.
- Sentry-disabled Azurite behaves the same as before this slice.
- All runtime requirements remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Review Questions

- Should this observability foundation become the next numbered slice, moving
  create-new-notes later in the roadmap?
- Should the backend project use Sentry's Fastify platform path or the generic
  Node.js path if the Sentry UI presents both?
- Should the first implementation include source-map upload infrastructure, or
  only release naming plus local source maps until production-like builds exist?
- Should Session Replay run for every enabled development session, or only when
  an explicit debug flag is present?
