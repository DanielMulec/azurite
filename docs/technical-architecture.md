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

## Initial Markdown Package Set

The top-level markdown processing stack names the ecosystem. The first concrete
packages for Slice 1 are:

- `unified`: pipeline foundation for parsing and transforming markdown-related
  syntax trees.
- `remark-parse`: parses markdown into an mdast syntax tree.
- `mdast-util-to-string`: extracts readable text from heading nodes for note
  titles.

Future slices may add:

- `remark-gfm`, `remark-rehype`, and `rehype-sanitize` for rendering.
- `remark-frontmatter` or equivalent frontmatter parsing support for metadata.
- wiki-link packages such as `remark-wiki-link` or `mdast-util-wiki-link`, but
  only in a focused wiki-link slice.

Keep slice-specific implementation details in
`docs/slices/slice-1-workspace-discovery.md`.

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
  slices/
  technical-architecture.md
  working-agreement.md
  research-sources.md
```

## First Product Slice

The first implementation slice should prove that Azurite can open a markdown
workspace from anywhere on the filesystem and safely list the markdown notes
inside it.

Detailed plan: `docs/slices/slice-1-workspace-discovery.md`.

Initial behavior:

- Start a local server with an explicit workspace path.
- Recursively discover `.md` files inside that workspace.
- Return a note list through an API.
- Avoid writing to the workspace during this slice.

## Second Product Slice

The second implementation slice reads one selected markdown note by its
workspace-relative note ID and returns raw markdown plus metadata without
exposing absolute filesystem paths.

Detailed plan: `docs/slices/slice-2-safe-note-reading.md`.

Initial behavior:

- Keep the configured workspace path on the server.
- Accept a slash-separated note ID through
  `GET /api/notes/content?noteId=...`.
- Validate that the note ID is relative, markdown-only, and cannot traverse
  outside the workspace.
- Reuse the existing workspace-root, path-boundary, note metadata, and title
  extraction behavior from Slice 1.
- Return raw markdown as data, not rendered HTML.
- Avoid new packages during this slice.

## Local Server Lifecycle

The local Fastify server should shut down gracefully when the process receives
`SIGINT` or `SIGTERM`.

- Register shutdown handlers in the server entrypoint, not inside route modules.
- Close Fastify with `server.close()` before process exit.
- Treat intentional `Ctrl+C` shutdown as a clean local shutdown and avoid noisy
  forced-kill output from development tooling.
- Keep a short fallback exit for local development so a process that is already
  shutting down does not hang.
- Prefer the plain server `tsx` dev command over watch mode until a watcher path
  can preserve the same clean shutdown behavior.
- Keep shutdown behavior small and testable through server lifecycle helpers.

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

- Keep every code file at 400 physical lines or fewer. This is a hard limit:
  401 lines is too many. Split files by responsibility before they reach the
  limit.
- Keep code modular and separated by concern. A file should have one clear job,
  and package boundaries should keep frontend, server, shared contracts, and
  core knowledge behavior independent.
- Reuse existing schemas, types, helpers, and domain functions when they express
  the same concept. Do not create parallel data shapes or duplicate logic for
  behavior the codebase already owns.
- When reused functionality needs one more capability for a new context, extend
  the existing helper or schema deliberately instead of creating a near-copy.
  Cover every supported context with tests.
- Extract shared functionality into clearly named helpers when multiple modules
  need the same behavior.
- Use TypeScript for repository utility scripts. Do not add `.mjs` files unless
  an external dependency or tool requirement makes TypeScript impractical; if
  that exception is needed, document why.
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
- Document exported public APIs with short JSDoc/TSDoc comments that explain
  their purpose in beginner-readable language.
- Write plain-language comments for non-obvious internal code, especially where
  a beginner reader would otherwise need to reverse-engineer intent.
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

- `max-lines` with max `400` for code files
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

### Reuse And Duplication

- Prefer existing shared schemas and inferred types over creating new shapes for
  the same API or domain concept.
- Prefer existing core helpers for workspace roots, note IDs, path boundaries,
  title extraction, and note metadata whenever a new slice touches the same
  behavior.
- Extend an existing helper when the new behavior is part of the same domain
  concept. Keep the helper readable, keep its responsibility narrow, and add
  tests for the old and new contexts.
- Add a new helper only when it has a clear responsibility and removes real
  duplication or clarifies a repeated domain operation.
- Do not copy and adjust logic across modules. Move shared behavior to the
  narrowest appropriate package instead.

### Architecture Boundaries

- `no-restricted-imports`

Use this to enforce monorepo boundaries. For example, the web app must not
import server internals, the server must not import React code, and shared
behavior should flow through `packages/core` and `packages/shared`.

As the codebase grows, add a dependency graph tool such as dependency-cruiser if
ESLint import restrictions are no longer expressive enough to enforce module
boundaries, circular dependency policy, or feature-level separation.

### Documentation Comments

- Require JSDoc/TSDoc comments for exported APIs in app and package source
  files.
- Keep comments short and useful: explain purpose, constraints, or surprising
  behavior.
- Do not require comments for every local helper. Prefer readable names and
  small functions first, then comments where intent would otherwise be hidden.

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
