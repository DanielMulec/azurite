# Technical Architecture

## Purpose

This document describes Azurite's current system architecture and durable
ownership boundaries. It does not serve as a slice history, engineering-style
guide, or operational runbook.

- Product direction: `docs/product-vision.md`
- Engineering rules: `docs/engineering-standards.md`
- Product-slice workflow: `docs/working-agreement.md`
- Active and completed slices: `docs/slices/README.md`
- Operational procedures: `docs/runbooks/README.md`
- Stable contracts: `docs/reference/README.md`

## Current Stack

- Runtime: Node.js 26.x.
- Package manager: pnpm 11.x workspaces.
- Language: TypeScript 6.x across backend, frontend, shared packages, and
  repository utilities.
- Backend: Fastify 5.x.
- Frontend: React 19.x with Vite 8.x.
- Styling: Tailwind CSS 4.x through the official Vite plugin, plus local semantic
  CSS tokens.
- Markdown dialect: CommonMark plus GitHub Flavored Markdown.
- Editor: Milkdown with Crepe.
- Runtime validation and shared contracts: Zod 4.x.
- Live client state: Zustand.
- URL state: TanStack Router.
- Durable browser recovery: Dexie over IndexedDB.
- Development observability: Sentry JavaScript SDK 10.x, split into React web
  and Fastify server projects behind explicit local-debug configuration.
- Testing: Vitest for unit and integration coverage; browser tooling for rendered
  and end-to-end QA.
- Linting and formatting: ESLint 9.x and Prettier 3.x.
- Private access: local binding by default with Tailscale-oriented phone access.

The installed package manifests and lockfile are the version source of truth.
Prefer the newest compatible version line only when a focused dependency change
has verified peer compatibility and product behavior.

## Repository Shape

```text
apps/
  web/       React, Vite, editor UI, URL state, live state, browser persistence
  server/    Fastify local API, runtime configuration, server lifecycle

packages/
  core/      cluster and note filesystem behavior, markdown parsing
  shared/    runtime schemas, API contracts, stable constants

docs/
  reference/ stable product and API contracts
  research/  domain-specific research catalogs
  runbooks/  repeatable operational procedures
  slices/    active, planned, and archived delivery records
```

Frontend, server, shared contracts, and core knowledge behavior remain behind
clear package boundaries. The web app does not import server internals; the
server does not import React code; core does not depend on UI frameworks or
observability SDKs.

## Product Terminology

"Cluster" is the user-facing term for Azurite's folder-backed knowledge
container. "Workspace" remains the current implementation and API term until a
focused rename updates schemas, routes, tests, environment variables, and UI
copy together.

A cluster can live anywhere appropriate on the user's system. It is independent
of this source repository and remains usable by ordinary filesystem tools.

## Current Product Baseline

Azurite currently supports this end-to-end workflow:

1. Fastify opens a configured filesystem cluster.
2. Core discovers markdown notes and exposes safe relative note metadata.
3. The web app lists notes and selects a note through URL-owned state.
4. Core reads raw markdown within the verified cluster boundary.
5. Milkdown and Crepe render and edit the selected markdown note.
6. Manual save writes an existing note through a content-hash conflict contract
   and atomic temporary-file replacement.
7. Zustand owns live note and editor state.
8. Dexie persists unsaved drafts by durable cluster ID and note ID.
9. Reload, tab discard, missing-note recovery, and external disk changes surface
   explicit recovery or conflict states rather than silently discarding intent.

The implementation and completion evidence for this baseline live in
`docs/slices/archive/`.

## Knowledge And Storage Boundaries

Azurite follows the file-over-app principle:

- Markdown files are the canonical knowledge source.
- `.azurite/cluster.json` stores app-owned durable cluster identity.
- IndexedDB stores browser recovery state, not canonical note content.
- Future indexes and caches must be rebuildable from cluster files and safe to
  delete.
- Application source, installed runtime files, and user-selected clusters remain
  conceptually and physically separable.

State ownership is explicit:

- URL: addressable selected-note navigation and browser history.
- Zustand: current in-memory note, editor, save, conflict, and UI session state.
- Dexie: durable browser drafts and recovery metadata.
- Markdown files: canonical document content.
- Future derived index: note metadata, headings, tags, links, backlinks, search
  fields, and graph projections.

Do not move canonical note content into a database without explicitly revisiting
the markdown-first product promise.

## API And Contract Boundaries

Stable routes, query parameters, error codes, note IDs, cluster metadata, and
response shapes originate in `packages/shared` and are documented in
`docs/reference/`.

The server validates external input and keeps route handlers thin. Filesystem
resolution, discovery, reading, metadata, hashing, and writing live in
`packages/core`.

Current note writes:

- accept only validated workspace-relative markdown note IDs;
- require the expected content hash;
- reject stale writes with the shared conflict response;
- preserve dominant existing line endings;
- write a temporary file in the target directory and rename it over the
  original;
- never expose absolute filesystem paths in browser responses.

## Markdown Rendering And Editing

Milkdown with Crepe owns the active WYSIWYG editor surface. Markdown remains the
serialized source of truth, and source mode remains available as a complementary
editing path.

Editor capabilities must round-trip through Azurite's selected markdown dialect.
Do not introduce proprietary blocks or a canonical JSON document model without
a deliberate product decision.

Any separate markdown-to-HTML rendering path must sanitize output before DOM
insertion. Raw HTML remains disabled unless a focused slice defines and tests a
safe extension.

## Browsing, Indexing, And Search Direction

Direct filesystem discovery is acceptable for the current baseline but already
measured roughly 2.8–3.2 seconds for 555 copied markdown files. A future indexing
slice should introduce a rebuildable derived index when repeated scans prevent a
responsive browsing or search workflow.

UI packages may render trees, virtualize rows, or provide search controls. They
must not own note identity, cluster rules, filesystem semantics, or canonical
knowledge state.

An indexing decision must define:

- rebuild and invalidation behavior;
- file-watch and external-edit semantics;
- schema ownership and migration behavior;
- search, backlink, and graph consumers;
- failure and recovery behavior when derived state is missing or corrupt.

## Local Server Lifecycle

The local Fastify server shuts down gracefully on `SIGINT` and `SIGTERM`.

- Shutdown handlers live in the server entrypoint or lifecycle boundary, not in
  route modules.
- Fastify stops accepting work before process exit.
- Intentional local shutdown remains quiet and bounded by a short fallback.
- Observability flush work may extend the enabled-mode fallback only when the
  flush budget remains shorter than the process-exit budget.

## Local And Tailscale Access

Azurite binds locally by default. For phone QA, the backend remains on
`127.0.0.1` while Vite binds only to the required Tailscale interface and proxies
API requests.

The operational procedure, including MagicDNS and allowed-host handling, lives
in `docs/runbooks/tailscale-phone-access.md`.

Authentication, packaged-service hosting, and any broader network exposure
remain explicit future architecture decisions. Public internet exposure is not
part of the current product boundary.

## Development Observability

Sentry owns Daniel-enabled development error capture, structured logs, tracing,
and browser Session Replay. Azurite owns typed configuration, shared event
contracts, and small runtime adapters; observability does not become product
state, and `packages/core` remains free of Sentry imports.

The browser runtime uses `@sentry/react` and the backend uses `@sentry/node`.
Both are disabled unless the matching enabled flag is the literal `true` and a
DSN is present. The web entrypoint dynamically loads its SDK runtime before
React render only when enabled. The server starts through Azurite's custom ESM
preload, which loads the optional root `.env.local` and dynamically imports the
Node SDK before Fastify only when enabled. Fastify 5 uses Sentry's supported
diagnostics-channel integration; Pino remains the local server log.

Enabled browser debug sessions use uncensored Replay defaults, explicit trace
sampling, and warning/error console capture. Relative browser API requests are
trace-propagated through Vite to local-only Fastify. Enabled backend shutdown
closes Fastify first, flushes Sentry for up to `1000ms`, records the result, and
uses a bounded `400ms` follow-up flush to deliver that result. Its `1500ms`
fallback remains longer than both budgets together. Disabled shutdown retains
the original `500ms` fallback and performs no Sentry work.

Typed helpers in `packages/shared`, `apps/web`, and `apps/server` form the
extension seam for planned correlation and semantic diagnostics. Direct Sentry
calls stay inside runtime adapter modules. Operational configuration and proof
steps live in `docs/runbooks/sentry-debug.md`.

Explicit debug mode may capture complete Azurite product data needed to diagnose
failures. Credential containment from
`docs/reference/product-guardrails.md` still applies.

## Security Architecture

- Treat markdown and filesystem content as untrusted input.
- Validate API inputs and outputs through shared runtime schemas.
- Restrict reads and writes to the configured cluster root.
- Reject traversal, ignored-directory access, and escaping symlinks.
- Keep the backend local by default and restrict trusted origins.
- Require origin checks or equivalent CSRF protection for state-changing routes.
- Keep unsafe HTML out of the browser unless it passes the approved sanitizer.
- Add Content Security Policy before broadening the installable PWA surface.
- Keep secrets out of committed files, browser payloads, and telemetry.

Security claims must be backed by boundary validation and failure-mode tests,
not by assuming unsafe states are impossible.

## Deferred Architecture Decisions

These decisions remain open and should be settled by the first product slice
that genuinely needs them:

- cluster picker and persisted local cluster configuration;
- full workspace-to-cluster implementation terminology migration;
- derived index, file watching, search, backlinks, and graph storage;
- PWA service-worker and offline behavior;
- authentication and hardened Tailscale hosting;
- production distribution and update strategy;
- release source-map upload and production observability policy;
- CI provider and required checks;
- exact supported desktop and mobile browser matrix.
