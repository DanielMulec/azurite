# Technical Architecture

## Initial Stack Decision

Use this stack for the first high-fidelity slice:

- Runtime: Node.js 26.x.
- Package manager: pnpm 11.x workspaces.
- Language: TypeScript 6.x across backend, frontend, and shared packages.
- Backend: Fastify 5.x.
- Frontend: React 19.x plus Vite 8.x.
- Frontend styling: Tailwind CSS 4.x through the official Vite plugin.
- PWA support: Vite-based PWA setup when the first installable shell is needed.
- Markdown dialect: CommonMark plus GitHub Flavored Markdown.
- Markdown editor surface: Milkdown with Crepe.
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

## Markdown Package Set

The top-level markdown package stack names the ecosystem. The first concrete
packages for Slice 1 are still used in core:

- `remark-parse`: parses markdown into an mdast syntax tree.
- `mdast-util-to-string`: extracts readable text from heading nodes for note
  titles.

Future slices may add:

- `remark-frontmatter` or equivalent frontmatter parsing support for metadata.
- wiki-link packages such as `remark-wiki-link` or `mdast-util-wiki-link`, but
  only in a focused wiki-link slice.

Slice 3 temporarily used these packages for a read-only rendered note body:

- `remark-gfm`: enables selected GitHub Flavored Markdown structures.
- `remark-rehype`: converts markdown syntax trees into HTML syntax trees.
- `rehype-sanitize`: removes unsafe HTML before browser rendering.
- `rehype-stringify`: serializes sanitized HTML for the approved read-only
  renderer.
- `@tailwindcss/typography`: styles rendered markdown content.

Slice 4 removes that temporary read-only renderer from the active selected-note
surface and uses:

- `@milkdown/crepe`: the WYSIWYG markdown editor surface Daniel selected from
  the Milkdown Playground direction.
- `@milkdown/kit`: Milkdown utilities such as markdown extraction and content
  replacement.

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
  reference/
  slices/
  technical-architecture.md
  working-agreement.md
  research-sources.md
```

## Reference Contracts

Reusable product and system details live in `docs/reference/`.

Use reference docs for stable details that multiple slices, packages, tests, or
future UI states should name consistently, such as API error codes, runtime
messages, route shapes, reserved workspace names, and note-ID rules.

When a reference detail also exists in code, prefer a typed shared source of
truth in `packages/shared` and keep the reference doc aligned with it.

## Product Terminology

Azurite's user-facing term for its Obsidian-vault-like knowledge container is
"cluster".

Current backend, API, tests, and reference contracts still use "workspace" for
the configured filesystem root. Treat that as an implementation term until a
focused rename slice updates shared types, route docs, tests, environment
variables, and user-facing copy together.

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

## Third Product Slice

The third implementation slice turns the first two backend slices into visible
read-only product behavior in the web app.

Detailed plan: `docs/slices/slice-3-read-only-markdown-viewer.md`.

Initial behavior:

- List workspace notes in the React app through `GET /api/notes`.
- Select the first note automatically when notes load.
- Read selected note content through `GET /api/notes/content?noteId=...`.
- Render markdown through the approved sanitized pipeline.
- Style the first real product surface with Tailwind CSS and local semantic
  design tokens.
- Keep editing, workspace picking, backlinks, graph behavior, search, and file
  watching out of this slice.

## Fourth Product Slice

The fourth product slice replaces the read-only note body with a Milkdown and
Crepe editor surface before Azurite invests further in note browsing polish,
search, or indexing.

Detailed plan: `docs/slices/slice-4-milkdown-crepe-editor-surface.md`.

Initial behavior:

- Replace the current `NoteViewer` product concept with an editable note
  surface.
- Use Milkdown with Crepe as the selected-note editor experience.
- Load selected-note markdown through the existing read API.
- Allow local in-memory WYSIWYG editing.
- Allow switching to plain markdown source mode.
- Keep markdown files as canonical content.
- Avoid save, autosave, write APIs, conflict detection, and file mutation until
  the focused persistence slice.

## Fifth Product Slice

The fifth product slice starts safe markdown persistence with explicit manual
save. It proves trusted writes for existing notes before note creation,
recoverable delete, or autosave.

Detailed plan: `docs/slices/slice-5-safe-manual-save-foundation.md`.

Initial behavior:

- Extend selected-note reads with a content hash.
- Save existing markdown notes through `PUT /api/notes/content`.
- Use `expectedContentHash` to reject stale saves with HTTP `409 Conflict` and
  shared error code `note_write_conflict`.
- Reuse existing note ID and path traversal protections for writes.
- Persist by writing a temporary file in the target directory and renaming it
  over the original note.
- Preserve dominant existing line endings.
- Show dirty, saving, saved, conflict, and failed save states.
- Keep autosave, merge UI, create, rename, delete, file watching, indexing, and
  graph behavior out of this slice.

## Persistence Roadmap After Slice 5

After safe manual save exists, the next persistence slices should prioritize
core note lifecycle actions before autosave.

- Slice 6: create new markdown notes.
- Slice 7: recoverable delete or move-to-trash behavior.
- Later separate numbered slice: autosave policy.

Create and delete are higher-priority user experience work than autosave
because they let Azurite become a complete capture and note-management surface.
Autosave remains valuable, but it is a comfort layer on top of trusted save,
create, and recoverable delete semantics.

## Frontend Styling

Use Tailwind CSS as the styling foundation, with local semantic CSS tokens for
Azurite-specific color and surface decisions.

Initial rules:

- Configure Tailwind through `@tailwindcss/vite`.
- Keep global styling in one web stylesheet imported by the React entrypoint.
- Keep editor styling local to Azurite tokens and the selected editor package.
- Use simple local React components for trivial, slice-local UI.
- Do not hand-roll complex accessible primitives. When a focused slice needs
  dialogs, menus, tabs, command palettes, forms, tooltips, trees, virtualized
  lists, or search UI, evaluate focused packages such as `shadcn/ui`, Radix UI,
  React Aria, tree components, virtualizers, or search UI primitives.
- UI packages may own component behavior, accessibility, composition, and
  rendering performance. They must not own Azurite's note identity, workspace
  indexing, search semantics, filesystem model, or canonical knowledge state.
- Keep product surfaces quiet, readable, and optimized for repeated knowledge
  work rather than landing-page composition.

## Browsing, Indexing, And State

Azurite follows the "file over app" principle: markdown files on disk are the
canonical knowledge source. The application may build derived state, but that
state must be rebuildable from the workspace files and safe to delete.

Browsing packages are candidates for UI and interaction primitives only. Azurite
owns note identity, folder structure, workspace rules, search semantics, and
product behavior. A package may help render a tree, virtualize rows, or run a
client-side search, but no package should own the knowledge model.

Keep state separated by responsibility:

- UI state: selected note, expanded folders, sidebar sizing, last-opened note,
  and other interface preferences. This can begin in React state or browser
  storage when persistence is useful.
- Derived workspace index: note IDs, paths, titles, modified times, sizes,
  folder tree, headings, tags, links, backlinks, and search fields. This is the
  likely place for SQLite or a similar local index/cache once repeated
  filesystem scanning is no longer acceptable.
- Canonical document content: the `.md` files in the user's workspace. Do not
  move canonical note content into SQLite unless the markdown-first product
  promise is explicitly reconsidered.

The Slice 3 human smoke test against 555 copied markdown files showed that
direct filesystem discovery is acceptable for the first read-only viewer, but
`GET /api/notes` took roughly 2.8-3.2 seconds during that run. That is useful
evidence for a future index slice: efficient browsing across hundreds or
thousands of notes should use a derived workspace index instead of repeatedly
scanning the full tree.

Do not install SQLite or search/index packages opportunistically. Evaluate them
in a focused indexing/search slice after the renderer/editor-stack decision,
because the editor may affect which metadata, document structure, and read-only
rendering hooks need to be indexed.

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

## Tailscale Phone Access During Development

When Azurite needs to be tested from Daniel's phone over Tailscale, keep the
backend bound to localhost whenever the frontend can proxy API requests. Expose
only the Vite frontend to the tailnet.

Preferred flow:

1. Read the Tailscale device details with `tailscale status --self --json`.
2. Use `Self.DNSName` as the MagicDNS hostname in the user-facing URL.
3. Use the first IPv4 address in `TailscaleIPs` as the Vite bind host.
4. Keep the Fastify server on `127.0.0.1:3000`.
5. Start Vite on the Tailscale IP at port `5173`.

If Tailscale Serve is enabled, it can proxy `127.0.0.1:5173` to the tailnet. If
Tailscale Serve is disabled for the tailnet, bind Vite directly to the
Tailscale interface instead:

```sh
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=macbook-air-von-daniel.taila0b671.ts.net \
  /opt/homebrew/bin/pnpm --filter @azurite/web exec vite \
  --host 100.123.102.3 \
  --port 5173
```

The `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` value matters. Vite 8 rejects
requests whose `Host` header is not allowed. Without this environment variable,
the Tailscale IP can work while the MagicDNS URL returns `403`. Add the MagicDNS
hostname there so Daniel can use:

```text
http://macbook-air-von-daniel.taila0b671.ts.net:5173/
```

For longer phone-testing sessions, run the server and web process in a named
`tmux` session such as `azurite-phone-slice6`. Use `/opt/homebrew/bin/pnpm` so
the repo runs through the Node 26 toolchain, not Codex's bundled Node 24 pnpm
wrapper.

## Mobile Session Resilience

Mobile browser testing on July 8, 2026 showed that Android Chrome and Edge can
reload the Azurite tab while Daniel switches away to another app. The current
frontend then starts from the first sorted note again because selected-note
state and draft editor state are only held in React memory.

This is a near-term product requirement, not a cosmetic issue. The mobile app
must recover from browser reloads, tab discard, app switching, and reconnects in
a way that preserves user intent.

Implementation direction:

- Persist the selected note ID outside React memory. A URL query parameter or
  hash is preferred because it makes reloads, sharing, and browser history
  explicit.
- Restore the selected note after reload when the note still exists.
- If the selected note no longer exists, show a clear missing-note state instead
  of silently jumping to the first note.
- Add browser storage for unsaved draft recovery before relying on mobile
  editing for real notes.
- Scope recovered drafts by workspace/cluster identity and note ID so drafts do
  not leak across clusters or files.
- Treat recovered drafts as unsaved UI state, not canonical content. Saving must
  still go through the Slice 5 content-hash conflict guard.
- If the file changed while the browser was asleep, show the conflict path
  rather than overwriting disk content.

Until this exists, mobile QA that requires leaving the browser can reload the
page before a conflict or save attempt. That is expected current behavior and
should be treated as evidence for this resilience slice, not as proof that the
save route failed.

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
- The next foundational rendering/editing slice should evaluate WYSIWYG editor
  candidates that can also provide read-only rendered note views.
- A raw markdown editor remains a fallback or complementary mode, but it is no
  longer the default next step while the temporary read-only renderer is still
  unresolved.
- Evaluate editor candidates through a focused slice that tests markdown
  round-trip fidelity, malformed markdown, large-note behavior, read-only
  rendering, and implications for indexing/search state.

Do not adopt an editor model that stores the canonical document as proprietary
JSON or non-markdown blocks.

The Slice 3 read-only renderer is intentionally a thin, replaceable adapter. It
exists to prove safe note browsing and sanitized display before Azurite commits
to an editor stack. Do not grow it into a parallel rendering or editing
architecture. Before implementing editing, decide whether the chosen editor stack
replaces, wraps, or reuses this renderer.

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
