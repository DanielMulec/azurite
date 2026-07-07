# Slice 3: Read-Only Markdown Viewer

## Status

Complete.

Implemented in commit `3fa92f0`.

This slice now serves as both the implementation plan and the completion record
for the first read-only markdown viewer.

## Goal

Teach Azurite one small, visible product behavior:

Given a configured workspace with markdown notes, the web app can list notes,
select one note, read it through the existing local API, and render its markdown
content safely in the browser.

This slice proves the first real frontend-to-backend note browsing flow,
sanitized markdown rendering, responsive read-only layout, and user-facing
loading, empty, and error states. It does not edit notes, save files, parse
backlinks, parse tags, parse frontmatter, watch files, search notes, persist an
index, or add workspace selection.

## Out Of Scope

- Editing and saving markdown.
- Workspace picker UI.
- Backlinks, tags, wiki links, unresolved links, or graph views.
- Frontmatter extraction.
- File watching.
- Persistent index storage.
- Search.
- PWA installation behavior.
- Serving the built frontend from Fastify.
- Custom non-standard markdown blocks.
- Command palette, dialogs, menus, tabs, and advanced UI primitives.
- A broad design-system rollout beyond the components this slice needs.

## Package Decisions For This Slice

Add the smallest package set needed for a polished read-only markdown viewer.

In `apps/web`:

- Add `tailwindcss`.
- Add `@tailwindcss/vite`.
- Add `@tailwindcss/typography`.
- Add `unified`.
- Add `remark-parse`.
- Add `remark-gfm`.
- Add `remark-rehype`.
- Add `rehype-sanitize`.
- Add `rehype-stringify`.

Add component testing packages only if implementation uses component-level
tests:

- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

Do not add `shadcn/ui`, Radix UI, large component libraries, editor packages,
wiki-link packages, `chokidar`, search packages, database packages, or cache
packages in this slice.

## Frontend Design Stack

Use Tailwind CSS v4 for the first real web UI styling layer.

Rules:

- Configure Tailwind through the official Vite plugin.
- Add a single global stylesheet imported by the web entrypoint.
- Define local semantic design tokens in CSS for Azurite-specific surfaces,
  text, borders, muted states, and accent color.
- Use `@tailwindcss/typography` for rendered markdown content.
- Keep styling quiet, readable, and knowledge-work focused.
- Build local React components first instead of adopting a component kit.

Why:

- Tailwind gives the web app responsive layout and state styling without
  inventing a CSS architecture from scratch.
- The typography plugin gives rendered markdown sensible defaults.
- Local semantic tokens keep Azurite visually distinct and avoid template-like
  UI decisions.

## Reuse And Extension Decisions

- Reuse shared API route constants from `@azurite/shared`.
- Reuse shared API response schemas for frontend response validation.
- Reuse the note summary and note content contracts from Slice 1 and Slice 2.
- Keep frontend API fetching behind a small `apps/web` API client.
- Keep markdown rendering in a dedicated frontend renderer module.
- Keep `dangerouslySetInnerHTML` contained inside the approved sanitized
  markdown renderer component.
- Keep filesystem behavior in `packages/core` and server route code.
- Keep server runtime config out of shared frontend constants.

## Route Usage

Use the existing routes:

```text
GET /api/notes
GET /api/notes/content?noteId=Projects/azurite.md
```

Frontend code must build route paths through `@azurite/shared` helpers rather
than retyping route strings.

For local development, configure the Vite dev server to proxy relative `/api`
and `/health` requests to the local Fastify server at `http://127.0.0.1:3000`.
This keeps browser code using same-origin relative paths while preserving the
server's local runtime configuration.

## Markdown Rendering Rules

Render markdown through a dedicated pipeline:

1. Parse markdown with `remark-parse`.
2. Enable GitHub Flavored Markdown with `remark-gfm`.
3. Convert markdown syntax trees to HTML syntax trees with `remark-rehype`.
4. Sanitize the HTML syntax tree with `rehype-sanitize`.
5. Serialize safe HTML with `rehype-stringify`.

Rules:

- Treat markdown as untrusted user content.
- Disable raw HTML in markdown for this slice.
- Do not pass unsanitized markdown-derived HTML to React.
- Do not allow script tags, event handler attributes, or unsafe URL protocols.
- Preserve common markdown output such as headings, paragraphs, lists, emphasis,
  links, code, blockquotes, tables, strikethrough, and task-list checkboxes when
  supported by the approved sanitized pipeline.
- Keep any future sanitizer schema expansions covered by tests.

Renderer guardrail:

- Treat the Slice 3 renderer as a small, replaceable read-only adapter.
- Do not expand this renderer into a parallel editor or document architecture.
- Before implementing editing, evaluate whether the chosen editor stack
  replaces, wraps, or reuses this renderer.
- Keep future rendering/editor decisions in a focused editor-stack slice.

## UI Behavior

Build a read-only note browsing layout.

### Initial Load

- Load the note list from `GET /api/notes`.
- Show a loading state while the note list request is pending.
- Show a safe error state if the note list request fails.
- Show an empty workspace state when the note list succeeds with no notes.

### Selection

- Automatically select the first note when notes load and no note is selected.
- Keep the selected note ID in React state.
- Select a different note when the user chooses it from the list.
- Keep the selected note visually distinct.

### Note Detail

- Load selected note content from `GET /api/notes/content?noteId=...`.
- Show a loading state while the selected note request is pending.
- Keep an already rendered note visible while a newly selected note is loading.
- Show a safe error state if the selected note request fails.
- Render the selected note title, safe metadata, and sanitized markdown content.
- Do not display absolute filesystem paths.

### Layout

- Provide a responsive two-region layout:
  - note list/navigation region
  - note reading region
- Keep the mobile layout usable on a narrow smartphone viewport.
- Keep desktop layout efficient for scanning and reading.
- Avoid decorative landing-page treatment; this is the product surface.

## Step-By-Step Implementation Plan

### 1. Add Frontend Styling Foundation

In `apps/web`:

- Install Tailwind CSS and the Tailwind Vite plugin.
- Install the Tailwind typography plugin.
- Update the Vite config to include Tailwind.
- Add a global stylesheet for Tailwind import and Azurite semantic tokens.
- Import the stylesheet from the web entrypoint.

Validation:

- Web package typecheck passes.
- Web package tests pass.
- The app renders with the stylesheet loaded.

### 2. Add Frontend API Client

In `apps/web`:

- Add a small API client for listing notes.
- Add a small API client for reading one note.
- Build request paths with `apiRoutes` and `createNoteContentRoute`.
- Parse successful responses with shared schemas.
- Convert failed requests or invalid payloads into safe frontend error states.

Validation:

- API client tests cover successful note-list responses.
- API client tests cover successful note-content responses.
- API client tests cover failed HTTP responses.
- API client tests cover invalid response payloads.

### 3. Add Sanitized Markdown Renderer

In `apps/web`:

- Add a markdown-to-safe-HTML renderer module.
- Add a React component that renders only sanitized HTML.
- Keep `dangerouslySetInnerHTML` limited to that approved component.
- Use Tailwind typography classes for markdown content.

Validation:

- Renderer tests cover headings, paragraphs, links, code, lists, tables, task
  lists, strikethrough, and blockquotes.
- Renderer tests prove raw HTML, scripts, event attributes, and unsafe URL
  protocols do not survive sanitization.

### 4. Build Read-Only Note Browser UI

In `apps/web`:

- Replace the placeholder app content with the note browser.
- Add a note-list component.
- Add a note-viewer component.
- Add loading, empty, and error state components.
- Select the first note automatically after a successful note-list load.
- Load and render selected note content.

Validation:

- Component tests or browser checks prove the note list appears.
- Component tests or browser checks prove the first note auto-selects.
- Component tests or browser checks prove the selected note renders.
- Component tests or browser checks prove error and empty states do not break
  layout.

### 5. Configure Local Development Proxy

In `apps/web`:

- Proxy `/api` requests to `http://127.0.0.1:3000`.
- Proxy `/health` requests to `http://127.0.0.1:3000`.
- Keep browser code using relative URLs.

Validation:

- Local web development can call the local API without hardcoding host and port
  in application code.

## Manual Verification

Create a temporary workspace with:

```text
index.md
Projects/azurite.md
unsafe.md
```

Use content that covers:

- a level-1 heading
- paragraphs
- a nested list
- a table
- a task list
- inline code and fenced code
- a normal link
- unsafe HTML such as `<script>` and event handler attributes

Run:

```bash
AZURITE_WORKSPACE_PATH=/tmp/azurite-test-workspace pnpm --filter @azurite/server dev
pnpm --filter @azurite/web dev
```

Use the Browser plugin first for the UI smoke check. If Browser has problems,
fall back to Playwright. If Playwright has problems and the task depends on
current user browser state, fall back to the Chrome plugin.

Check:

- The note list appears.
- The first note auto-selects.
- Selecting another note updates the rendered note.
- Markdown renders as formatted content, not raw source text.
- Unsafe HTML does not execute or render dangerous attributes.
- Empty workspace state is readable and does not break layout.
- Error state is readable and does not expose absolute filesystem paths.
- Layout works at a narrow smartphone viewport and a desktop viewport.

## Automated Validation

Run:

```bash
pnpm validate
pnpm build
```

## Acceptance Criteria

- `apps/web` has the first real read-only note browsing UI.
- The frontend lists notes through the existing API.
- The frontend reads selected note content through the existing API.
- The first available note auto-selects after the note list loads.
- Markdown renders through the approved sanitized pipeline.
- Raw HTML remains disabled for this slice.
- `dangerouslySetInnerHTML` is limited to the approved sanitized renderer.
- UI states cover loading, empty workspace, selected note, and safe errors.
- API response parsing uses shared schemas.
- Route construction uses shared route constants/helpers.
- Browser smoke verification covers note list, auto-selection, selected note
  rendering, and stable error/empty layouts.
- API responses and UI do not expose absolute filesystem paths.
- Validation and build commands pass.

## Open Questions

None.

## Next Slice After This

Add the next narrow interaction layer after read-only viewing works. Good
candidates are a raw markdown editor for the selected note, a workspace picker,
or a focused wiki-link rendering slice. Choose based on which behavior best
improves daily note reading and editing after Slice 3 is verified.
