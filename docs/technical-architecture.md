# Technical Architecture

## Initial Stack Decision

Use this stack for the first high-fidelity slice:

- Runtime: Node.js 26.x.
- Package manager: pnpm 11.x workspaces.
- Language: TypeScript 6.x across backend, frontend, and shared packages.
- Backend: Fastify 5.x.
- Frontend: React 19.x plus Vite 8.x.
- PWA support: Vite-based PWA setup when the first installable shell is needed.
- Markdown dialect: CommonMark plus GitHub Flavored Markdown.
- Markdown processing: unified, remark, rehype, and rehype-sanitize.
- Validation: Zod 4.x for runtime validation and shared API contracts.
- Testing: Vitest 4.x for unit and integration tests, Playwright plus available
  browser tooling for end-to-end and rendered UI checks.
- Linting: ESLint 9.x, using the latest compatible major for the selected
  TypeScript, React hooks, and JSX accessibility plugins.
- Formatting: Prettier 3.x.
- Private access: bind locally by default and use Tailscale-oriented access for
  trusted device access.

This stack is intended to support a local-first, markdown-first PWA without
coupling the product to a public SaaS deployment model.

Prefer the installed local toolchain when it is newer than an earlier proposal,
unless there is a concrete compatibility reason not to. For package
dependencies, use the newest compatible version line rather than forcing a major
version that breaks required peer dependencies or rules.

## Repo Shape

Start with this structure when creating the application skeleton:

```text
apps/
  web/       React + Vite PWA
  server/    Fastify local API and static app server

packages/
  core/      workspace reading, note discovery, markdown parsing
  shared/    API schemas, shared types, constants

docs/
  product-vision.md
  technical-architecture.md
  working-agreement.md
  research-sources.md
```

## First Product Slice

The first implementation slice should prove that Azurite can open a markdown
workspace from anywhere on the filesystem and display notes correctly in a local
PWA.

Initial behavior:

- Start a local server with an explicit workspace path.
- Recursively discover `.md` files inside that workspace.
- Return a note list through an API.
- Return one note's raw markdown through an API.
- Render one selected note in the web UI using the approved markdown pipeline.
- Avoid writing to the workspace during this slice.

## Frontend And Commercial Optionality

React plus Vite is the initial app-shell choice because it keeps the local PWA
simple, has a strong editor and markdown ecosystem, and avoids server-rendering
assumptions that are unnecessary for the first local-first slices.

This choice should not trap the product. Keep the knowledge engine, markdown
processing, API contracts, and indexing behavior outside framework-specific UI
components. If Azurite later becomes a public SaaS, white-label product, or
commercially distributed app, the backend and core packages should remain useful
even if the frontend shell changes.

Next.js may become useful later for a public web product, hosted SaaS surface,
or marketing/product site, but it is not required for the first local PWA.
Svelte, Solid, and Vue remain viable alternatives if a future slice gives us a
strong product reason to change.

## Markdown Rendering And Editing

The frontend must eventually provide a Notion-like editing experience while
remaining markdown-backed.

Important constraints:

- Markdown files remain the source of truth.
- Early editing must only support structures that round-trip cleanly to markdown.
- The read-only renderer comes first to prove safe workspace access and markdown
  rendering.
- A raw markdown editor is the likely next editing slice because it best
  preserves exact markdown content.
- A richer comfort layer can then add shortcuts, toolbar actions, slash commands,
  task toggles, heading changes, and block-level interactions for
  markdown-supported structures.
- Richer WYSIWYG markdown editors may be evaluated later, but only through a
  focused research slice that tests round-trip fidelity, malformed markdown, and
  large-note behavior.

Do not adopt an editor model that stores the canonical document as proprietary
JSON or non-markdown blocks.

## TypeScript And Code Quality Rules

Use strict, beginner-readable TypeScript.

- Enable TypeScript strict mode.
- Enable `noImplicitAny`.
- Ban explicit `any`; use `unknown`, discriminated unions, generics, or specific
  domain types instead.
- Keep cyclomatic complexity at 3 or lower per function, matching the intended
  spirit of a McCabe score of 3.
- Enforce complexity with linting once ESLint is configured.
- Split functions before they become clever.
- Use human, on-the-nose names for functions, variables, types, files, and tests.
- Prefer names that explain the domain behavior over abbreviations.
- Write plain-language comments for non-obvious code, especially where a
  beginner reader would otherwise need to reverse-engineer intent.
- Comments should explain why a decision exists or how a tricky block works; do
  not use comments to restate obvious code.

These rules are part of the product's maintainability goal. The code should be
understandable by future contributors and by Daniel while learning from it.

## ESLint Rule Baseline

Use ESLint with typed TypeScript linting, React rules, accessibility rules, and
project-specific architecture restrictions.

Start from the recommended strict type-checked TypeScript ESLint configuration,
then add these project rules:

### Type Safety

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/no-unsafe-assignment`
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-return`
- `@typescript-eslint/no-unsafe-argument`

These rules keep `any` from entering through dependencies, JSON, mocks, or
shortcuts.

### Async Safety

- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-misused-promises`

Promises must be awaited, returned, handled, or intentionally marked as ignored.
This matters for file I/O, server routes, and UI event flows.

### Null And Logic Safety

- `@typescript-eslint/no-non-null-assertion`
- `@typescript-eslint/strict-boolean-expressions`
- `@typescript-eslint/no-unnecessary-condition`
- `@typescript-eslint/switch-exhaustiveness-check`

Code should handle missing values and union cases explicitly instead of relying
on unchecked assumptions.

### Beginner-Readable Code Shape

- `complexity` with max `3`
- `max-depth` with max `2`
- `max-params` with max `3`
- `max-lines-per-function` with an initial max of `60`
- `curly`
- `eqeqeq`
- `prefer-const`
- `no-var`

These rules keep functions small, control flow shallow, and intent easier to
read.

### Architecture Boundaries

- `no-restricted-imports`

Use this to enforce monorepo boundaries. For example, the web app must not
import server internals, the server must not import React code, and shared
behavior should flow through `packages/core` and `packages/shared`.

### Security

- `no-eval`
- `no-implied-eval`
- restrict `dangerouslySetInnerHTML` so only the approved sanitized markdown
  renderer can use it
- restrict `console` in frontend production code, while allowing proper server
  logging

ESLint is only one security layer. Markdown sanitization, path traversal tests,
origin checks, and API validation are still required.

### React And Accessibility

- `react-hooks/rules-of-hooks`
- `react-hooks/exhaustive-deps`
- `jsx-a11y` recommended rules

React hook rules prevent stale state and invalid hook usage. Accessibility rules
catch common UI issues early, but they do not replace rendered accessibility
testing.

### Rules To Avoid Initially

- Do not enable `no-magic-numbers` at the start; it is likely to be noisy during
  early product shaping.
- Do not require explicit return types for every local function; require them at
  public package boundaries and exported APIs first.
- Do not add stylistic rules that conflict with Prettier.

Any disabled lint rule must include a short explanation near the disable comment.

## Formatting

Use Prettier for automatic formatting.

- Let Prettier own whitespace, indentation, line wrapping, semicolons, quotes,
  trailing commas, JSON, YAML, Markdown, CSS, and TypeScript formatting.
- Do not add ESLint style rules that fight Prettier.
- Use ESLint for correctness, safety, maintainability, accessibility, and
  architecture rules.
- Run formatting as part of the normal validation flow once the skeleton exists.

## Security And Validation Baseline

Security must be designed into the first slice rather than added as a cleanup
task.

- Treat markdown content as untrusted data.
- Prevent cross-site scripting by design, not by convention.
- Sanitize rendered markdown HTML before it reaches the DOM.
- Disable or tightly control raw HTML in markdown until a deliberate decision is
  made.
- Never inject markdown output into the page unless it has passed through the
  approved sanitizer.
- Validate API inputs and outputs at runtime with shared schemas.
- Restrict filesystem reads and writes to the selected workspace root.
- Prevent path traversal outside the workspace.
- Bind the server locally by default.
- Restrict CORS to trusted origins.
- Add origin checks or CSRF protection before introducing state-changing API
  routes.
- Add a Content Security Policy before broadening the PWA surface.
- Add tests for path traversal, malicious markdown, unsupported HTML, and API
  validation failures.

Do not claim security bugs are impossible. Instead, make unsafe behavior hard to
express, validate boundaries, and test the important failure modes.

## Tooling And Policy Still To Define

Before or during the skeleton slice, decide the exact tools for:

- TypeScript version and shared `tsconfig` layout.
- Exact ESLint package versions, flat-config layout, and per-folder overrides.
- Prettier config and formatting command.
- Lint disable policy and review expectations.
- Dependency update policy and lockfile expectations.
- Environment variable naming and `.env` handling.
- Workspace path configuration and local settings storage.
- Logging format and error reporting style.
- Accessibility baseline for the PWA.
- Browser support target for desktop and smartphone use.
- Build, test, and local run commands.
- CI checks once GitHub Actions or another CI path is introduced.
