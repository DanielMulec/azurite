# Slice 2: Safe Markdown Note Reading

## Status

Planned.

This is the implementation plan for the next product slice after
`docs/slices/slice-1-workspace-discovery.md`.

## Goal

Teach Azurite one small, real product behavior:

Given a configured workspace and a valid note ID from that workspace, Azurite
can safely return the raw markdown content and metadata for that one note.

This slice proves safe note-ID validation, workspace-bounded file resolution,
single-note reading, response validation, and safe error behavior. It does not
render markdown, edit files, parse backlinks, parse tags, parse frontmatter,
watch files, search notes, or persist an index.

## Out Of Scope

- Markdown-to-HTML rendering.
- Frontend note detail UI.
- Editing and saving markdown.
- Sanitized HTML rendering pipeline.
- Backlinks, tags, wiki links, unresolved links, or graph views.
- Frontmatter extraction.
- File watching.
- Persistent index storage.
- Search.
- Workspace picker UI.
- Accepting absolute filesystem paths as note IDs.

## Package Decisions For This Slice

Add no new packages in this slice.

Use the existing stack:

- Node filesystem and path APIs for file checks, stats, and reading.
- Existing `@azurite/core` workspace-root helpers.
- Existing `@azurite/core` path-boundary helpers.
- Existing `@azurite/core` markdown title extraction.
- Existing `@azurite/shared` Zod schema pattern.
- Existing Fastify route pattern in `apps/server`.
- Existing Vitest setup for package and route tests.

Do not add `remark-rehype`, `rehype-sanitize`, `remark-gfm`,
frontmatter-specific packages, wiki-link packages, `chokidar`, search packages,
database packages, or cache packages in this slice.

## Reuse And Extension Decisions

- Reuse the existing note-summary concept for note metadata.
- Add a note-content data shape that extends the note-summary concept with raw
  markdown.
- Reuse the existing safe API error response shape.
- Reuse workspace-root resolution instead of resolving configured paths again in
  route code.
- Reuse path-boundary helpers for workspace escape prevention.
- Extend a path-boundary helper only when note-ID resolution needs a capability
  the current helper does not expose.
- Reuse markdown title extraction instead of adding a second title parser.
- Keep filesystem behavior in `packages/core`; keep server route code thin.
- Add tests for old and new contexts when an existing helper is extended.

## Data Shapes

Add shared schemas in `packages/shared` so backend, frontend, and tests agree on
the contract.

### Note ID Input

Represents the note that should be read from the configured workspace.

Fields:

- `noteId`: slash-separated path relative to the workspace root.

Rules:

- Must be non-empty.
- Must end in `.md`.
- Must use `/` separators.
- Must not be an absolute path.
- Must not contain `..` segments.
- Must not contain empty path segments such as `foo//bar.md`.
- Must not expose or accept private absolute filesystem paths.

Valid examples:

- `index.md`
- `Projects/azurite.md`
- `Daily/2026-07-07.md`

Invalid examples:

- `""`
- `/Users/daniel/Notes/index.md`
- `../secret.md`
- `Projects/../secret.md`
- `Projects//azurite.md`
- `ignored.txt`

### Note Content

Represents the full API-safe version of one note.

Fields:

- `id`: slash-separated path relative to the workspace root.
- `relativePath`: same stable relative path used for display and lookup.
- `fileName`: base file name, such as `azurite.md`.
- `title`: first level-1 markdown heading, falling back to the file name without
  `.md`.
- `markdown`: raw markdown file contents.
- `lastModifiedAt`: ISO timestamp from filesystem metadata.
- `sizeBytes`: file size in bytes.

Rules:

- Must not include absolute filesystem paths.
- Must keep `id` and `relativePath` aligned with the existing note-summary
  behavior.
- Must return raw markdown as data, not rendered HTML.

### Read Note Response

Represents the successful API response.

Fields:

- `note`: note content.

### API Error Response

Reuse the existing safe API error response.

Rules:

- Do not expose private absolute paths in public API errors.
- Keep detailed filesystem errors in server logs, not frontend payloads.
- Return stable error codes for invalid input, missing workspace configuration,
  missing notes, and unsafe note IDs.

## Route Shape

Add:

```text
GET /api/notes/content?noteId=Projects/azurite.md
```

Use a query parameter because note IDs contain slashes. This avoids route-path
encoding ambiguity and keeps the existing list route, `GET /api/notes`, stable.

## Step-By-Step Implementation Plan

### 1. Add Shared Note Reading Schemas

In `packages/shared`:

- Add a note-ID input schema.
- Add a note-content schema.
- Add a read-note response schema.
- Export schemas and inferred types from the package index.
- Reuse the existing note-summary fields for shared metadata.
- Reuse the existing safe API error schema.

Validation:

- Shared package typecheck passes.
- Shared package tests cover valid and invalid note IDs.
- Shared package tests cover valid note-content and read-note response payloads.

### 2. Add Note ID Validation Rules

In `packages/shared`:

- Validate that `noteId` is a relative markdown note identifier.
- Reject absolute paths.
- Reject path traversal segments.
- Reject empty path segments.
- Reject non-markdown file names.
- Keep the validation behavior independent of the local operating system path
  separator.

Tests:

- Accepts `index.md`.
- Accepts `Projects/azurite.md`.
- Rejects an empty string.
- Rejects `/absolute/path.md`.
- Rejects `../secret.md`.
- Rejects `Projects/../secret.md`.
- Rejects `Projects//azurite.md`.
- Rejects `ignored.txt`.

### 3. Add Core Note ID Resolution

In `packages/core`:

- Accept a verified workspace root and a validated note ID.
- Convert the slash-separated note ID into a candidate filesystem path.
- Resolve the candidate file with `realpath`.
- Verify the resolved file remains inside the verified workspace root.
- Verify the resolved path exists.
- Verify the resolved path is a regular file.
- Verify the resolved path still represents a markdown file.
- Reject symlinks that escape the workspace.
- Return a small verified value that contains the safe relative ID and the
  private absolute file path needed by core internals.

Rules:

- Route code must not construct trusted filesystem paths.
- Absolute filesystem paths must remain private to `packages/core`.
- Existing path-boundary helpers must be reused or extended deliberately.

Tests:

- Resolves a top-level note.
- Resolves a nested note.
- Rejects traversal outside the workspace.
- Rejects absolute paths.
- Rejects non-markdown files.
- Rejects missing files.
- Rejects directories.
- Rejects symlinked files that point outside the workspace.
- Keeps returned public IDs slash-separated and relative.

### 4. Add Core Note Reading

In `packages/core`:

- Add `readWorkspaceNote`.
- Resolve the configured workspace path with the existing workspace-root helper.
- Resolve the note ID with the new core note-ID resolver.
- Read the markdown file as UTF-8 text.
- Extract the title with the existing markdown title helper.
- Read filesystem stats for modification time and size.
- Return note content using the shared note-content shape.

Rules:

- Do not expose absolute paths in returned data.
- Do not duplicate note-summary metadata assembly when an existing helper can be
  reused or extended.
- Keep markdown as raw text.

Tests:

- Reads top-level notes.
- Reads nested notes.
- Returns markdown content exactly as stored.
- Returns title, relative path, file name, modification time, and size.
- Falls back to file name when no level-1 heading exists.
- Does not expose absolute paths.

### 5. Add The Server Route

In `apps/server`:

- Add `GET /api/notes/content`.
- Validate the `noteId` query parameter with the shared schema.
- Use the same configured workspace behavior as Slice 1.
- Call the core note-reading function.
- Validate the success response with the shared schema before returning it.
- Return safe API errors for missing workspace configuration, invalid note IDs,
  missing notes, and unsafe filesystem resolution.

Rules:

- Keep route logic thin.
- Keep private filesystem details out of response bodies.
- Keep `GET /api/notes` unchanged.

Tests:

- Missing workspace configuration returns a safe error.
- Missing `noteId` returns a safe validation error.
- Invalid `noteId` returns a safe validation error.
- Valid note IDs return markdown plus metadata.
- Missing notes return a safe not-found error.
- Traversal attempts return a safe error.

### 6. Validate The Slice

Run:

```bash
cd /Users/danielmulec/Projekte/azurite
/opt/homebrew/bin/npx --yes pnpm@11.7.0 validate
/opt/homebrew/bin/npx --yes pnpm@11.7.0 build
```

Also manually confirm the route with a temporary workspace.

Setup:

```bash
cd /Users/danielmulec/Projekte/azurite
mkdir -p /tmp/azurite-test-workspace/Projects
printf '# Home\n\nWelcome.\n' > /tmp/azurite-test-workspace/index.md
printf '# Azurite Plan\n\nSlice notes.\n' > /tmp/azurite-test-workspace/Projects/azurite.md
printf '## No H1 here\n\nFallback title test.\n' > /tmp/azurite-test-workspace/untitled.md
printf 'Ignore me.\n' > /tmp/azurite-test-workspace/ignored.txt
AZURITE_WORKSPACE_PATH=/tmp/azurite-test-workspace /opt/homebrew/bin/npx --yes pnpm@11.7.0 --filter @azurite/server dev
```

Valid request from another terminal:

```bash
cd /Users/danielmulec/Projekte/azurite
curl 'http://127.0.0.1:3000/api/notes/content?noteId=Projects/azurite.md'
```

Invalid traversal request from another terminal:

```bash
cd /Users/danielmulec/Projekte/azurite
curl 'http://127.0.0.1:3000/api/notes/content?noteId=../secret.md'
```

Manual review expectations:

- The valid response contains one `note` object.
- The valid response contains raw markdown text.
- The valid response contains only relative note identifiers and safe metadata.
- The valid response does not contain an absolute filesystem path.
- The invalid traversal response is a safe error.
- Missing note IDs and missing notes fail safely.

## Acceptance Criteria

The slice is complete when:

- `packages/shared` defines and tests note-ID input, note-content, and read-note
  response schemas.
- `packages/core` can resolve a validated note ID inside a verified workspace
  root.
- `packages/core` rejects traversal, absolute paths, non-markdown targets,
  missing files, directories, and symlink escapes.
- `packages/core` can read one markdown file and return raw markdown plus
  metadata.
- `apps/server` exposes `GET /api/notes/content?noteId=...`.
- `apps/server` returns safe errors for invalid input, missing notes, unsafe
  paths, and missing workspace configuration.
- API responses do not expose absolute filesystem paths.
- Tests cover schema validation, core path safety, core note reading, and server
  route behavior.
- Validation and build commands pass.

## Open Questions

None.

## Next Slice After This

Render the selected note through the approved sanitized markdown pipeline and
show it in the web UI.
