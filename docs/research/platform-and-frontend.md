# Platform And Frontend Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

### Node.js Releases

- URL: https://nodejs.org/en/about/previous-releases
- Accessed: 2026-07-07
- Area: Runtime selection
- Use when: Choosing supported Node.js versions for production-oriented work.
- Notes: Node.js recommends production applications use Active LTS or
  Maintenance LTS releases. Azurite currently targets Node.js 26.x by project
  decision to match the local development runtime.
- Caveats: Re-check before production distribution because LTS status changes
  over time.

### pnpm Workspaces

- URL: https://pnpm.io/workspaces
- Accessed: 2026-07-07
- Area: Package management and monorepo structure
- Use when: Setting up or revisiting the multi-package repository layout.
- Notes: pnpm has built-in workspace support using `pnpm-workspace.yaml`.
- Caveats: Compare with npm workspaces if minimizing tooling requirements
  becomes more important than stricter dependency behavior.

### React Build Tool Guidance

- URL: https://react.dev/learn/build-a-react-app-from-scratch
- Accessed: 2026-07-07
- Area: Frontend app shell
- Use when: Reconsidering the React plus Vite frontend decision.
- Notes: React documents Vite as a build-tool option for a React app.
- Caveats: React also recommends frameworks for many production web apps; the
  local-first PWA context is why Azurite starts with Vite instead.

### React StrictMode

- URL: https://react.dev/reference/react/StrictMode
- Accessed: 2026-07-14
- Area: React lifecycle conformance
- Use when: Designing or verifying render purity and repeatable resource setup
  and cleanup across Azurite's React roots.
- Notes: Full-root StrictMode development checks include extra component render,
  Effect setup-cleanup-setup, and ref callback setup-cleanup-setup cycles. React
  uses these checks to expose impure render and missing cleanup.
- Caveats: StrictMode exposes lifecycle defects but does not prove Azurite's
  external resource counts or absence of duplicate product actions; focused
  ledgers and browser acceptance remain required.

### Vite Guide

- URL: https://vite.dev/guide/
- Accessed: 2026-07-07
- Area: Frontend build tooling
- Use when: Creating or updating the web app skeleton.
- Notes: Vite supports React TypeScript templates and requires a supported Node
  version.
- Caveats: Check current compatibility requirements before upgrading Node or
  Vite.

### Fastify Documentation

- URL: https://fastify.dev/
- Accessed: 2026-07-07
- Area: Backend framework
- Use when: Building the local HTTP API server.
- Notes: Fastify is a Node.js web framework with TypeScript support and a plugin
  model.
- Caveats: Route schema and validation choices still need a focused
  implementation decision.

### Fastify Decorators

- URL: https://fastify.dev/docs/latest/Reference/Decorators/
- Accessed: 2026-07-10
- Area: Backend request-scoped correlation
- Use when: Adding typed request metadata that every Fastify note route can read
  without a module-global current-request value.
- Notes: Fastify request decorators establish the request object shape before
  handling and should use a value-shaped placeholder such as `null`; a fresh
  object can then be assigned for each request in `onRequest`.
- Caveats: Do not place a shared reference object on the request prototype.
  Correlation context must be created independently for every request.

### Fastify Server Reference

- URL: https://fastify.dev/docs/latest/Reference/Server/
- Accessed: 2026-07-07
- Area: Local binding and private access
- Use when: Configuring server host and port behavior.
- Notes: Fastify documents localhost defaults and warns about listening on all
  interfaces.
- Caveats: Revisit when adding Tailscale-specific access modes, Docker, or
  installable service packaging.

### Web Crypto `randomUUID`

- URL: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID
- Accessed: 2026-07-10
- Area: Browser correlation identifier generation
- Use when: Generating standards-shaped UUID-v4 request and operation IDs in a
  secure browser context.
- Notes: `crypto.randomUUID()` creates a cryptographically secure UUID version 4
  and is restricted to secure contexts.
- Caveats: Azurite's current physical-phone MagicDNS development origin uses
  HTTP, so `randomUUID()` cannot be the only browser generation path.

### Web Crypto `getRandomValues`

- URL: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
- Accessed: 2026-07-10
- Area: Browser correlation identifier generation
- Use when: Creating an RFC 4122 UUID-v4 fallback for the current HTTP MagicDNS
  phone-development origin.
- Notes: `crypto.getRandomValues()` provides cryptographically strong random
  bytes and is the Web Crypto method exposed in insecure contexts. Version and
  variant bits must be set explicitly when formatting UUID-v4 values.
- Caveats: If secure random bytes are unavailable or throw, correlation should
  degrade without blocking product requests; never fall back to `Math.random`.

### CommonMark Spec

- URL: https://spec.commonmark.org/
- Accessed: 2026-07-07
- Area: Markdown dialect
- Use when: Defining baseline markdown behavior and tests.
- Notes: CommonMark provides a standardized markdown specification and test
  cases.
- Caveats: Azurite also intends to support selected GFM extensions.

### File Over App

- URL: https://stephango.com/file-over-app
- Accessed: 2026-07-07
- Area: Product data philosophy
- Use when: Reconfirming why Azurite keeps markdown files as the canonical
  knowledge source instead of letting app state own user knowledge.
- Notes: Articulates the principle that durable digital artifacts should be
  files users control, in readable formats.
- Caveats: A philosophy source, not an implementation guide; pair with concrete
  filesystem, indexing, and editor decisions.

### Obsidian Data Storage

- URL: https://obsidian.md/help/data-storage
- Accessed: 2026-07-07
- Area: Reference knowledge app data model
- Use when: Comparing Azurite's markdown-first cluster model with Obsidian's
  vault storage behavior.
- Notes: Obsidian stores notes as markdown-formatted plain text files in a local
  folder and allows other tools to edit those files.
- Caveats: Reference behavior only; Azurite should not copy Obsidian product
  concepts wholesale.

### remark-gfm

- URL: https://github.com/remarkjs/remark-gfm
- Accessed: 2026-07-07
- Area: Markdown dialect and parsing
- Use when: Adding GitHub Flavored Markdown support to the markdown pipeline.
- Notes: Supports GFM extensions such as autolinks, footnotes, strikethrough,
  tables, and task lists.
- Caveats: It does not turn markdown into HTML by itself; pair with the rest of
  the unified pipeline.

### Tailwind CSS Vite Plugin

- URL: https://tailwindcss.com/docs
- Accessed: 2026-07-07
- Area: Frontend styling
- Use when: Adding Tailwind CSS to the Vite React app.
- Notes: Tailwind documents the Vite plugin as the most seamless integration
  path for Vite-based projects.
- Caveats: Tailwind v4 targets modern browsers; revisit if Azurite later needs
  older browser support.

### Tailwind CSS Typography

- URL: https://v3.tailwindcss.com/docs/typography-plugin
- Accessed: 2026-07-07
- Area: Markdown content styling
- Use when: Styling rendered markdown or other generated HTML content.
- Notes: The first-party typography plugin provides `prose` classes for HTML
  generated from markdown or CMS-like content.
- Caveats: Typography defaults should be adapted with Azurite's local design
  tokens so rendered notes do not feel generic.

### shadcn/ui Vite Installation

- URL: https://ui.shadcn.com/docs/installation/vite
- Accessed: 2026-07-07
- Area: React/Vite UI component composition
- Use when: Evaluating whether a focused UI slice needs copy-owned component
  patterns for dialogs, menus, tabs, forms, tooltips, or other app primitives.
- Notes: shadcn/ui documents installation for Vite projects.
- Caveats: It is a component/design-system source, not a note-browsing,
  indexing, search, or knowledge-model solution.

### Zod

- URL: https://zod.dev/
- Accessed: 2026-07-07
- Area: Runtime validation and shared contracts
- Use when: Defining API schemas, config schemas, and runtime validation.
- Notes: Zod is TypeScript-first and infers static types from runtime schemas.
- Caveats: Keep schemas near domain boundaries so validation does not drift from
  actual API behavior.

### Vitest

- URL: https://vitest.dev/
- Accessed: 2026-07-07
- Area: Unit and integration testing
- Use when: Setting up TypeScript tests for frontend, backend, and shared code.
- Notes: Vitest is Vite-native and supports TypeScript and JSX out of the box.
- Caveats: Browser-level behavior still needs Playwright or browser tooling.

### React Testing Library

- URL: https://testing-library.com/docs/react-testing-library/intro/
- Accessed: 2026-07-07
- Area: React component testing
- Use when: Testing web UI components through user-observable behavior instead
  of implementation details.
- Notes: React Testing Library is a lightweight layer on top of React DOM test
  utilities and encourages tests that resemble how users interact with the UI.
- Caveats: It does not replace browser smoke checks for responsive layout,
  rendered CSS, and real navigation behavior.

### React Testing Library API

- URL: https://testing-library.com/docs/react-testing-library/api/
- Accessed: 2026-07-14
- Area: StrictMode component-test configuration
- Use when: Applying React StrictMode consistently to Azurite component tests.
- Notes: React Testing Library supports a global
  `configure({ reactStrictMode: true })` option and a per-render override.
- Caveats: The test-environment wrapper does not replace full-root product and
  QA wiring or real-browser lifecycle proof.

### Milkdown Editor Lifecycle Source

- URL: https://github.com/Milkdown/milkdown/blob/main/packages/core/src/editor/editor.ts
- Accessed: 2026-07-14
- Area: Editor creation-failure and teardown lifecycle
- Use when: Qualifying whether Crepe/Milkdown generations can be cleaned up
  dependably after pending or rejected creation.
- Notes: The current public editor implementation enters `OnCreate` before
  loading plugins. Public `destroy()` reschedules itself while that status is
  active, while a rejected `create()` does not transition the editor out of
  `OnCreate`. Azurite pins the installed 7.21.2 behavior with a contract test.
- Caveats: Repository `main` may change independently of Azurite's lockfile.
  Re-run the installed-version contract test before considering an upgrade or
  removing a local compatibility decision.

### TanStack Router

- URL: https://tanstack.com/router/latest/docs/overview
- Accessed: 2026-07-08
- Area: URL-addressable navigation and search-param state
- Use when: Adding typed route/search-param state to the React app.
- Notes: TanStack Router documents type-safe navigation, path/search parameter
  validation, and search-param state management APIs. Azurite should use it
  when selected-note navigation becomes a durable product contract.
- Caveats: Do not use router loader caching as the canonical note-content cache
  without a focused data-cache decision.

### TanStack Router Navigation Blocking

- URL: https://tanstack.com/router/latest/docs/guide/navigation-blocking
- Accessed: 2026-07-13
- Area: In-app transition admission and cancellation
- Use when: Holding application pushes or browser-history traversal while an
  outgoing editor session completes a required handoff.
- Notes: TanStack Router exposes asynchronous history blockers with current and
  next locations and supports disabling the browser `beforeunload` behavior.
  Azurite's target-free transition gate belongs behind this history boundary,
  before selected-note mutation or read admission.
- Caveats: The React blocker API is documented as experimental and latest docs
  do not replace installed-version proof. Verify boolean behavior, action
  classification, Back/Forward/Go restoration, and entry reachability directly
  against the locked dependency and real browsers before relying on cancellation.

### TanStack Router Events

- URL: https://tanstack.com/router/latest/docs/guide/router-events
- Accessed: 2026-07-13
- Area: Route lifecycle observation
- Use when: Confirming that one exact history occurrence has reached router
  resolution without treating a React effect or navigation promise as ownership.
- Notes: The router lifecycle distinguishes navigation start from resolution and
  exposes from/to location metadata. Azurite uses those events as observation and
  exact-occurrence confirmation around its history-admission owner.
- Caveats: `onBeforeNavigate` does not supply the history action and its location
  search is not a substitute for Azurite's route-level runtime validation. Keep
  action classification at the history boundary and validate with the existing
  application schema before issuing product reads.

### TanStack History Source

- URL: https://github.com/TanStack/router/blob/main/packages/history/src/index.ts
- Accessed: 2026-07-13
- Area: Browser-history identity, action, blocking, and restoration
- Use when: Implementing or upgrading Azurite's action-aware history-admission
  adapter and its installed-version contract tests.
- Notes: The history implementation owns per-entry keys/indexes, push/replace
  scheduling, action-aware blocker calls, and browser pop restoration. Those are
  the evidence boundary for preserving the real stack after cancellation; URL
  equality alone is insufficient.
- Caveats: Repository `main` and latest documentation can differ from Azurite's
  installed package. Inspect the locked source and prove exact application push,
  Back, Forward, and Go behavior in tests before store integration. Never infer
  safe traversal rollback from a same-URL final screenshot.

### Zustand

- URL: https://zustand.docs.pmnd.rs/
- Accessed: 2026-07-08
- Area: Frontend client/session state
- Use when: Introducing a React client-state boundary for selected note, editor
  session, save state, conflict state, and UI state.
- Notes: Zustand is a small hook-based state management library. Its docs also
  include persist middleware, but Azurite should treat Zustand's main role as
  live client state, with Dexie owning durable draft persistence.
- Caveats: Keep persistence decisions explicit. Do not store large note drafts
  in synchronous web storage just because a state middleware can persist values.

### Dexie

- URL: https://dexie.org/docs
- Accessed: 2026-07-08
- Area: IndexedDB-backed browser persistence
- Use when: Storing durable browser recovery state such as unsaved drafts,
  recovered conflicts, preferences, pending writes, and future rebuildable
  caches.
- Notes: Dexie provides a TypeScript-friendly API over IndexedDB with schema
  versions, named tables, indexes, and transactions. This fits Azurite's need
  for a real client persistence layer instead of string-keyed blobs.
- Caveats: Browser persistence remains recovery/cache state. Canonical markdown
  content stays on disk.

### Indexed Database API 3.0 Transaction Scheduling

- URL: https://w3c.github.io/IndexedDB/#transaction-scheduling
- Accessed: 2026-07-12
- Area: Browser-draft mutation ordering and durability semantics
- Use when: Designing concurrent IndexedDB write, delete, cleanup, and readback
  ownership for Azurite recovery state.
- Notes: The standard orders overlapping read/write transactions by creation
  time and prevents a later overlapping transaction from starting before an
  earlier one finishes. Azurite still owns a per-note mutation coordinator so
  this ordering is explicit at its injected persistence boundary and exact
  session snapshots remain testable with delayed adapters.
- Caveats: Transaction completion proves the browser transaction completed; it
  does not make unfinished `pagehide` or `visibilitychange` work synchronous or
  guarantee that a browser lifecycle callback runs before termination.

### MDN Web Storage API

- URL: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- Accessed: 2026-07-08
- Area: Browser storage behavior
- Use when: Comparing localStorage/sessionStorage with IndexedDB for frontend
  persistence.
- Notes: MDN documents Web Storage as origin-partitioned key/value storage and
  notes that localStorage/sessionStorage operations are synchronous. It points
  to asynchronous alternatives such as IndexedDB for larger data or
  performance-sensitive cases.
- Caveats: Web Storage can still be useful for tiny preferences, but it should
  not own Azurite's note draft bodies.

### MDN pagehide Event

- URL: https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
- Accessed: 2026-07-08
- Area: Browser page lifecycle
- Use when: Flushing pending draft writes before navigation, page hiding, or
  browser history transitions.
- Notes: MDN documents `pagehide` as a page lifecycle event fired when the
  browser hides the current page. Azurite should use it alongside continuous
  draft persistence and `visibilitychange`, not as the only save point.
- Caveats: Mobile browser behavior can still discard pages aggressively, so
  drafts must be persisted during editing instead of only at unload time.

### Chrome Page Lifecycle API

- URL: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- Accessed: 2026-07-08
- Area: Mobile browser lifecycle and tab discard behavior
- Use when: Designing resilient PWA behavior for app switching, backgrounding,
  freezing, and discarding.
- Notes: Chrome's lifecycle guidance is relevant to Android phone QA, where app
  switching can reload or discard the current browser tab.
- Caveats: Keep browser-specific guidance paired with standards-based events and
  real mobile QA over Tailscale.

### Playwright

- URL: https://playwright.dev/
- Accessed: 2026-07-07
- Area: End-to-end and browser testing
- Use when: Verifying rendered PWA behavior and cross-browser flows.
- Notes: Playwright supports Chromium, Firefox, and WebKit with auto-waiting and
  web-first assertions.
- Caveats: Keep tests focused on real user flows to avoid brittle UI automation.

### Tailscale Serve

- URL: https://tailscale.com/docs/features/tailscale-serve
- Accessed: 2026-07-07
- Area: Private local access
- Use when: Exposing the local app to trusted devices in the tailnet.
- Notes: Tailscale Serve can proxy a local service to devices in the user's
  tailnet and recommends localhost binding when relying on identity headers.
- Caveats: Do not confuse Serve with Funnel, which is for broader public access.

### React Arborist

- URL: https://github.com/jameskerr/react-arborist
- Accessed: 2026-07-07
- Area: Tree/file explorer UI
- Use when: Evaluating a complete React tree view for folder-aware note
  browsing.
- Notes: Provides a React tree component aimed at VS Code, Finder, Explorer, and
  similar sidebar patterns.
- Caveats: UI primitive only; Azurite must still own note identity, folder
  semantics, and workspace indexing.

### Headless Tree

- URL: https://headless-tree.lukasbach.com/
- Accessed: 2026-07-07
- Area: Headless tree interaction primitives
- Use when: Evaluating customizable folder-tree behavior with keyboard support,
  search, renaming, drag-and-drop, and accessibility.
- Notes: Headless Tree positions itself as customizable and accessible, with
  React bindings available.
- Caveats: Powerful interaction primitives can outpace product scope; adopt only
  through a focused note-browser slice.

### React Aria Tree

- URL: https://react-aria.adobe.com/Tree
- Accessed: 2026-07-07
- Area: Accessible tree UI primitives
- Use when: Evaluating lower-level accessible tree behavior for folder-aware
  note browsing.
- Notes: React Aria's tree follows its collection component model and supports
  dynamic collections.
- Caveats: Less visually opinionated; Azurite would need to provide layout,
  styling, and product behavior.

### TanStack Virtual

- URL: https://tanstack.com/virtual/latest
- Accessed: 2026-07-07
- Area: Large list and tree rendering performance
- Use when: Evaluating virtualization for large note lists, search results, or
  folder trees.
- Notes: Headless virtualization utility for rendering only the visible window
  of long lists, grids, and scroll containers.
- Caveats: Performance/rendering primitive only; it does not provide folder
  semantics, search, or persistence.
