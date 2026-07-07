# Research Sources

## Purpose

This document is a living list of useful sources discovered while researching,
designing, and building Azurite.

The list exists to make knowledge easier to reuse across sessions and future
contributors. It is a starting point, not a boundary. Sources collected here
should never be treated as the only sources to consult.

## How To Use This List

- Reuse relevant sources from this document when they help with the current task.
- Always look for additional current sources when research affects product,
  architecture, security, dependencies, standards, or implementation choices.
- Prefer primary sources such as official documentation, standards, source
  repositories, research papers, and maintainer-written material.
- Add sources when they materially inform a decision, implementation, or product
  direction.
- Keep notes concise and avoid copying long excerpts from external sources.
- Capture caveats, dates, and context so future readers know how much weight to
  give each source.

## Source Entry Template

```markdown
### Source Title

- URL:
- Accessed:
- Area:
- Use when:
- Notes:
- Caveats:
```

## Collected Sources

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
- Use when: Comparing Azurite's markdown-first workspace model with Obsidian's
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

### CodeMirror Markdown Language Support

- URL: https://github.com/codemirror/lang-markdown
- Accessed: 2026-07-07
- Area: Markdown editing
- Use when: Evaluating a raw markdown editor fallback or complementary source
  editing mode.
- Notes: Provides Markdown language support for CodeMirror.
- Caveats: Less suited to read-only rendered Notion-like viewing than richer
  editor candidates; a comfort layer still needs product-specific UI work.

### ProseMirror Markdown Example

- URL: https://prosemirror.net/examples/markdown/
- Accessed: 2026-07-07
- Area: Rich markdown editing research
- Use when: Evaluating richer WYSIWYG markdown editing.
- Notes: The markdown package defines a schema for what Markdown can express and
  includes parser/serializer behavior.
- Caveats: Must be tested for round-trip fidelity against Azurite's chosen
  markdown dialect.

### Milkdown

- URL: https://milkdown.dev/
- Accessed: 2026-07-07
- Area: Rich markdown editing research
- Use when: Evaluating WYSIWYG markdown editor options.
- Notes: Milkdown is a plugin-driven WYSIWYG markdown editor framework.
- Caveats: Do not adopt without a focused fidelity and complexity test.

### Tiptap Markdown

- URL: https://tiptap.dev/docs/editor/markdown
- Accessed: 2026-07-07
- Area: Rich markdown editing research
- Use when: Evaluating Tiptap for bidirectional markdown editing.
- Notes: Tiptap documents markdown parsing and serialization support.
- Caveats: The documented markdown feature is marked beta, so it needs careful
  validation before depending on it.

### TypeScript ESLint Configs

- URL: https://typescript-eslint.io/users/configs/
- Accessed: 2026-07-07
- Area: ESLint and TypeScript linting baseline
- Use when: Setting up or revisiting strict typed linting.
- Notes: Documents shared configs including strict type-checked options.
- Caveats: Typed linting has project setup and performance implications.

### Prettier

- URL: https://prettier.io/docs
- Accessed: 2026-07-07
- Area: Code formatting
- Use when: Setting up or revisiting automatic formatting.
- Notes: Prettier is an opinionated code formatter that reprints code into a
  consistent style.
- Caveats: Avoid ESLint stylistic rules that conflict with Prettier.

### TypeScript ESLint no-unsafe-assignment

- URL: https://typescript-eslint.io/rules/no-unsafe-assignment
- Accessed: 2026-07-07
- Area: Type safety
- Use when: Preventing `any` values from being assigned into typed variables or
  generic positions.
- Notes: Helps keep untyped data from silently spreading through the codebase.
- Caveats: JSON parsing and untyped third-party data should go through explicit
  validation instead of disable comments.

### TypeScript ESLint no-unsafe-argument

- URL: https://typescript-eslint.io/rules/no-unsafe-argument
- Accessed: 2026-07-07
- Area: Type safety
- Use when: Preventing `any` values from being passed into functions that expect
  specific types.
- Notes: Useful at API, validation, parser, and test boundaries.
- Caveats: Requires careful typing for helper utilities and test matchers.

### TypeScript ESLint no-floating-promises

- URL: https://typescript-eslint.io/rules/no-floating-promises/
- Accessed: 2026-07-07
- Area: Async safety
- Use when: Enforcing explicit promise handling.
- Notes: Reports promises that are not awaited, returned, caught, or explicitly
  ignored.
- Caveats: Intentional fire-and-forget work should be rare and clearly marked.

### TypeScript ESLint no-misused-promises

- URL: https://typescript-eslint.io/rules/no-misused-promises/
- Accessed: 2026-07-07
- Area: Async safety
- Use when: Preventing promises from being used in logical locations where they
  are not handled correctly.
- Notes: Complements `no-floating-promises`.
- Caveats: React event handlers may need careful configuration.

### TypeScript ESLint no-non-null-assertion

- URL: https://typescript-eslint.io/rules/no-non-null-assertion/
- Accessed: 2026-07-07
- Area: Null safety
- Use when: Preventing unchecked `!` assertions.
- Notes: Encourages code that proves values exist instead of bypassing the type
  system.
- Caveats: Rare generated-code or framework-boundary exceptions should be
  documented.

### TypeScript ESLint strict-boolean-expressions

- URL: https://typescript-eslint.io/rules/strict-boolean-expressions/
- Accessed: 2026-07-07
- Area: Logic safety
- Use when: Avoiding implicit truthy or falsy checks on non-boolean values.
- Notes: Makes conditions more explicit and beginner-readable.
- Caveats: Configure intentionally so optional strings and arrays are handled in
  a readable way.

### TypeScript ESLint no-unnecessary-condition

- URL: https://typescript-eslint.io/rules/no-unnecessary-condition/
- Accessed: 2026-07-07
- Area: Logic safety
- Use when: Removing conditions that types prove are always truthy, falsy, or
  nullish.
- Notes: Helps keep code and declared types aligned.
- Caveats: Can be sensitive to type declarations from dependencies.

### TypeScript ESLint switch-exhaustiveness-check

- URL: https://typescript-eslint.io/rules/switch-exhaustiveness-check/
- Accessed: 2026-07-07
- Area: Exhaustive handling
- Use when: Ensuring union and enum cases are fully handled.
- Notes: Useful for domain states, parser outcomes, and API result variants.
- Caveats: Works best with clear union types.

### ESLint complexity

- URL: https://eslint.org/docs/latest/rules/complexity
- Accessed: 2026-07-07
- Area: Code readability
- Use when: Enforcing low cyclomatic complexity.
- Notes: Caps the number of branches in a function.
- Caveats: A low max such as `3` will require frequent function extraction.

### ESLint no-restricted-imports

- URL: https://eslint.org/docs/latest/rules/no-restricted-imports
- Accessed: 2026-07-07
- Area: Architecture boundaries
- Use when: Enforcing monorepo import boundaries.
- Notes: Restricts static imports that should not cross package or app
  boundaries.
- Caveats: Dynamic imports and generated files may need separate policy.

### ESLint no-eval

- URL: https://eslint.org/docs/latest/rules/no-eval
- Accessed: 2026-07-07
- Area: Security linting
- Use when: Preventing direct `eval` usage.
- Notes: `eval` has security and performance implications.
- Caveats: Also configure `no-implied-eval` for string-based timers and similar
  patterns.

### ESLint no-implied-eval

- URL: https://eslint.org/docs/latest/rules/no-implied-eval
- Accessed: 2026-07-07
- Area: Security linting
- Use when: Preventing eval-like strings passed to timers or similar APIs.
- Notes: Complements `no-eval`.
- Caveats: Prefer function callbacks instead of strings.

### ESLint no-console

- URL: https://eslint.org/docs/latest/rules/no-console
- Accessed: 2026-07-07
- Area: Frontend production hygiene
- Use when: Restricting browser console calls in production code.
- Notes: Browser console calls are usually debugging leftovers.
- Caveats: Server code should use approved logging rather than this blanket
  browser-oriented rule.

### React Hooks exhaustive-deps

- URL: https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps
- Accessed: 2026-07-07
- Area: React correctness
- Use when: Enforcing correct hook dependency arrays.
- Notes: Helps prevent stale closures in hooks.
- Caveats: If the rule feels hard to satisfy, the hook likely needs simpler
  structure.

### JSX Accessibility ESLint Plugin

- URL: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- Accessed: 2026-07-07
- Area: Frontend accessibility
- Use when: Catching common accessibility issues in JSX.
- Notes: Performs static accessibility checks for React JSX.
- Caveats: Static linting does not replace rendered DOM testing or assistive
  technology checks.

### remark

- URL: https://github.com/remarkjs/remark
- Accessed: 2026-07-07
- Area: Markdown parsing and transformation
- Use when: Building markdown parsing, rendering, and future link or heading
  extraction behavior.
- Notes: remark is a plugin-based markdown processor that can inspect and change
  markdown through syntax trees.
- Caveats: It is a foundation, not a complete Obsidian-like knowledge engine.

### micromark

- URL: https://github.com/micromark/micromark
- Accessed: 2026-07-07
- Area: Markdown parsing internals
- Use when: Evaluating low-level markdown parsing, custom syntax, or positional
  token behavior.
- Notes: micromark is a CommonMark-compliant parser that tracks concrete tokens
  and positional information.
- Caveats: Prefer remark-level APIs first unless a lower-level extension is
  truly needed.

### remark-wiki-link

- URL: https://github.com/flowershow/remark-wiki-link
- Accessed: 2026-07-07
- Area: Wiki-style and Obsidian-style link parsing
- Use when: Researching support for `[[wikilinks]]` and embedded wiki links.
- Notes: Provides a remark plugin for wiki-style links, including Obsidian-style
  links.
- Caveats: Must be tested against Azurite's exact desired wiki-link behavior
  before adoption.

### mdast-util-wiki-link

- URL: https://github.com/landakram/mdast-util-wiki-link/
- Accessed: 2026-07-07
- Area: Wiki-link AST utilities
- Use when: Evaluating lower-level AST support for parsing and serializing
  wiki-style links.
- Notes: Supports wiki links, existing/new link handling, and aliased wiki-link
  syntax.
- Caveats: Syntax details may not exactly match Obsidian; verify before using.

### remark-frontmatter

- URL: https://github.com/remarkjs/remark-frontmatter
- Accessed: 2026-07-07
- Area: Markdown metadata
- Use when: Adding frontmatter awareness to the markdown pipeline.
- Notes: Adds support for YAML, TOML, and other frontmatter nodes in remark.
- Caveats: Frontmatter is metadata, not rendered content; extraction and
  validation may need separate handling.

### mdast-util-to-string

- URL: https://github.com/syntax-tree/mdast-util-to-string
- Accessed: 2026-07-07
- Area: Heading and title extraction
- Use when: Extracting plain text from markdown AST nodes such as headings.
- Notes: Useful for turning a heading node into its readable text.
- Caveats: Does not serialize markdown; it only extracts textual content.

### Chokidar

- URL: https://github.com/paulmillr/chokidar
- Accessed: 2026-07-07
- Area: Filesystem watching
- Use when: Adding live workspace updates after the first discovery slice.
- Notes: Normalizes file watching behavior on top of Node's filesystem watcher
  APIs.
- Caveats: File watching has platform edge cases; add focused tests and manual
  checks before relying on it for indexes.

### MiniSearch

- URL: https://github.com/lucaong/minisearch
- Accessed: 2026-07-07
- Area: Full-text search
- Use when: Evaluating lightweight note search for small-to-medium local
  workspaces.
- Notes: In-memory JavaScript full-text search engine that can run in Node or
  the browser.
- Caveats: Search helper only; do not let it own the workspace index or source
  content. May not be enough for very large workspaces or persistent indexing.

### Fuse.js

- URL: https://www.fusejs.io/
- Accessed: 2026-07-07
- Area: Fuzzy search
- Use when: Evaluating quick fuzzy title/path search for note switching or
  lightweight filtering.
- Notes: Lightweight JavaScript fuzzy-search library with no dependencies.
- Caveats: Better suited to small-to-medium client-side datasets than durable
  full-workspace indexing.

### FlexSearch

- URL: https://github.com/nextapps-de/flexsearch
- Accessed: 2026-07-07
- Area: Full-text search
- Use when: Evaluating faster or more configurable JavaScript search indexing.
- Notes: Offers document search, partial matching, suggestions, and worker-based
  scaling options.
- Caveats: Search/index helper only; compare API complexity and persistence
  needs before choosing it.

### SQLite Appropriate Uses

- URL: https://sqlite.org/whentouse.html
- Accessed: 2026-07-07
- Area: Persistent local indexes
- Use when: Evaluating SQLite as a local derived index/cache for workspace
  metadata, search fields, links, backlinks, and recents.
- Notes: SQLite is commonly used as an on-disk application file format for local
  applications.
- Caveats: In Azurite, SQLite should be a rebuildable derived index, not the
  canonical note store.

### Node.js SQLite

- URL: https://nodejs.org/api/sqlite.html
- Accessed: 2026-07-07
- Area: Built-in SQLite runtime support
- Use when: Comparing built-in Node SQLite support with third-party SQLite
  packages for local indexes.
- Notes: Node.js documents `node:sqlite` with `DatabaseSync` for opening
  in-memory or file-backed databases.
- Caveats: Check current stability, sync API constraints, and packaging needs
  before adopting.

### better-sqlite3

- URL: https://github.com/WiseLibs/better-sqlite3
- Accessed: 2026-07-07
- Area: Persistent local indexes
- Use when: Evaluating SQLite-backed caches, indexes, or metadata storage.
- Notes: Node SQLite library focused on performance, transactions, and a simple
  synchronous API.
- Caveats: Native dependency and packaging behavior must be tested for the final
  install model. Compare against Node's built-in SQLite support before adding.

### Kuzu

- URL: https://github.com/kuzudb/kuzu
- Accessed: 2026-07-07
- Area: Graph storage research
- Use when: Evaluating whether Azurite needs an embedded graph database instead
  of a simpler derived graph index.
- Notes: Embedded property graph database with Node.js API support.
- Caveats: Likely too heavy for early slices; consider only after graph
  requirements are clearer.

### Foam

- URL: https://github.com/foambubble/foam
- Accessed: 2026-07-07
- Area: Reference knowledge app
- Use when: Researching open-source Markdown knowledge-base behavior, backlinks,
  wiki links, and graph views.
- Notes: Open-source VS Code-based personal knowledge management system.
- Caveats: Reference behavior and architecture only; do not copy broad product
  assumptions without focused evaluation.

### SilverBullet

- URL: https://github.com/silverbulletmd/silverbullet
- Accessed: 2026-07-07
- Area: Reference self-hosted Markdown knowledge app
- Use when: Researching browser-based, self-hosted, Markdown-backed knowledge
  app patterns.
- Notes: Open-source private browser-based personal knowledge database using
  Markdown files.
- Caveats: Reference behavior and architecture only; Azurite's product direction
  remains its own.
