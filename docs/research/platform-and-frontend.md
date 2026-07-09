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

### Fastify Server Reference

- URL: https://fastify.dev/docs/latest/Reference/Server/
- Accessed: 2026-07-07
- Area: Local binding and private access
- Use when: Configuring server host and port behavior.
- Notes: Fastify documents localhost defaults and warns about listening on all
  interfaces.
- Caveats: Revisit when adding Tailscale-specific access modes, Docker, or
  installable service packaging.

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

### remark-rehype

- URL: https://unifiedjs.com/explore/package/remark-rehype/
- Accessed: 2026-07-07
- Area: Markdown rendering pipeline
- Use when: Converting parsed markdown syntax trees into HTML syntax trees for
  browser rendering.
- Notes: Bridges the remark markdown ecosystem to the rehype HTML ecosystem so
  HTML-oriented plugins can run after markdown parsing.
- Caveats: Sanitization still needs an explicit rehype sanitizer before output
  reaches the DOM.

### rehype-sanitize

- URL: https://github.com/rehypejs/rehype-sanitize
- Accessed: 2026-07-07
- Area: Markdown rendering security
- Use when: Rendering markdown-derived HTML into the PWA.
- Notes: Sanitizes HTML syntax trees by dropping anything not explicitly allowed.
- Caveats: Sanitization schemas need tests, especially if raw HTML or syntax
  highlighting is enabled later.

### rehype-stringify

- URL: https://unifiedjs.com/explore/package/rehype-stringify/
- Accessed: 2026-07-07
- Area: Markdown rendering pipeline
- Use when: Serializing a sanitized HTML syntax tree into an HTML string for the
  approved read-only markdown renderer.
- Notes: Works inside the unified pipeline after rehype plugins have transformed
  or sanitized the HTML tree.
- Caveats: Only stringify sanitized trees that have passed through the approved
  sanitizer.

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

### Vue Introduction

- URL: https://vuejs.org/guide/introduction
- Accessed: 2026-07-07
- Area: Frontend framework alternatives
- Use when: Reconsidering the frontend framework.
- Notes: Vue is a component framework built on standard HTML, CSS, and
  JavaScript.
- Caveats: No current product requirement outweighs React's ecosystem advantage
  for Azurite's first slices.

### Svelte Documentation

- URL: https://svelte.dev/
- Accessed: 2026-07-07
- Area: Frontend framework alternatives
- Use when: Reconsidering the frontend framework or researching compiler-based
  UI approaches.
- Notes: Svelte compiles components into efficient browser JavaScript.
- Caveats: Evaluate editor and markdown ecosystem fit before any switch.

### SolidJS Documentation

- URL: https://www.solidjs.com/docs/latest
- Accessed: 2026-07-07
- Area: Frontend framework alternatives
- Use when: Reconsidering the frontend framework or researching fine-grained
  reactivity.
- Notes: Solid is a declarative and efficient JavaScript UI library.
- Caveats: Its ecosystem is smaller than React's for editor-heavy applications.

### Next.js Documentation

- URL: https://nextjs.org/docs
- Accessed: 2026-07-07
- Area: Future commercial or hosted web surface
- Use when: Evaluating whether a hosted SaaS, public product, or marketing
  surface should use Next.js.
- Notes: Next.js is a React framework for full-stack web applications with
  routing, server features, and framework-level optimizations.
- Caveats: It is not required for the first local-first PWA slice.

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
