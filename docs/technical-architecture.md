# Technical Architecture

## Initial Stack Decision

Use this stack for the first high-fidelity slice:

- Runtime: Node.js 24 LTS.
- Package manager: pnpm workspaces.
- Language: TypeScript across backend, frontend, and shared packages.
- Backend: Fastify.
- Frontend: React plus Vite.
- PWA support: Vite-based PWA setup when the first installable shell is needed.
- Markdown dialect: CommonMark plus GitHub Flavored Markdown.
- Markdown processing: unified, remark, rehype, and rehype-sanitize.
- Validation: Zod for runtime validation and shared API contracts.
- Testing: Vitest for unit and integration tests, Playwright plus available
  browser tooling for end-to-end and rendered UI checks.
- Private access: bind locally by default and use Tailscale-oriented access for
  trusted device access.

This stack is intended to support a local-first, markdown-first PWA without
coupling the product to a public SaaS deployment model.

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
- ESLint rules, including no explicit `any`, no implicit `any`, and complexity.
- Formatter choice and formatting command.
- Dependency update policy and lockfile expectations.
- Environment variable naming and `.env` handling.
- Workspace path configuration and local settings storage.
- Logging format and error reporting style.
- Accessibility baseline for the PWA.
- Browser support target for desktop and smartphone use.
- Build, test, and local run commands.
- CI checks once GitHub Actions or another CI path is introduced.
