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
  Maintenance LTS releases.
- Caveats: Re-check before changing the runtime version because LTS status
  changes over time.

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

### remark-gfm

- URL: https://github.com/remarkjs/remark-gfm
- Accessed: 2026-07-07
- Area: Markdown dialect and parsing
- Use when: Adding GitHub Flavored Markdown support to the markdown pipeline.
- Notes: Supports GFM extensions such as autolinks, footnotes, strikethrough,
  tables, and task lists.
- Caveats: It does not turn markdown into HTML by itself; pair with the rest of
  the unified pipeline.

### rehype-sanitize

- URL: https://github.com/rehypejs/rehype-sanitize
- Accessed: 2026-07-07
- Area: Markdown rendering security
- Use when: Rendering markdown-derived HTML into the PWA.
- Notes: Sanitizes HTML syntax trees by dropping anything not explicitly allowed.
- Caveats: Sanitization schemas need tests, especially if raw HTML or syntax
  highlighting is enabled later.

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

### CodeMirror Markdown Language Support

- URL: https://github.com/codemirror/lang-markdown
- Accessed: 2026-07-07
- Area: Markdown editing
- Use when: Building the first raw markdown editor slice.
- Notes: Provides Markdown language support for CodeMirror.
- Caveats: A Notion-like comfort layer still needs product-specific UI work.

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
