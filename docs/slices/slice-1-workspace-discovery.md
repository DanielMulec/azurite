# Slice 1: Workspace Markdown Discovery

## Goal

Teach Azurite one small, real product behavior:

Given a folder anywhere on the system, Azurite can safely list the markdown
notes inside it.

This slice should prove the workspace boundary, path-safety model, note summary
shape, core discovery logic, and server API without adding note rendering,
editing, search, backlinks, graph behavior, or persistent indexes yet.

## Out Of Scope

- Reading full note bodies through the API.
- Rendering selected notes in the frontend.
- Editing and saving markdown.
- File watching.
- Persistent index storage.
- Search.
- Tags, backlinks, wiki links, unresolved links, or graph views.
- Workspace picker UI.
- Following symlinked directories.

## Package Decisions For This Slice

Use proven markdown primitives without adopting a full external knowledge
engine.

- Add `unified`, `remark-parse`, and `mdast-util-to-string` to `packages/core`.
- Use the markdown AST to extract the first level-1 heading as the note title.
- Do not add wiki-link packages yet; that belongs to a later focused slice.
- Do not add `chokidar` yet; this slice performs a fresh scan when requested.
- Do not add search or database packages yet; this slice returns derived data
  directly from the filesystem.

## Data Shapes

Add shared schemas in `packages/shared` so the backend, frontend, and tests agree
on the shape of the data.

### Workspace Path Input

Represents the path Azurite should treat as the workspace root.

Fields:

- `workspacePath`: string

Rules:

- Must be non-empty.
- May be absolute or user-provided text at the API boundary.
- Must be resolved and validated in `packages/core` before it becomes trusted.

### Note Summary

Represents the lightweight list-item version of a note, not the full note body.

Fields:

- `id`: slash-separated path relative to the workspace root.
- `relativePath`: same stable relative path used for display and lookup.
- `fileName`: base file name, such as `Azurite.md`.
- `title`: first level-1 markdown heading, falling back to the file name without
  `.md`.
- `lastModifiedAt`: ISO timestamp from filesystem metadata.
- `sizeBytes`: file size in bytes.

Rules:

- Must not include absolute filesystem paths.
- Must be stable across server responses unless the file path changes.
- Must use `/` separators even on systems with different path separators.

### List Notes Response

Represents the successful API response.

Fields:

- `notes`: array of note summaries.

Rules:

- Notes should be sorted by `relativePath`.
- Empty workspaces return an empty array, not an error.

### API Error Response

Represents a safe error response.

Fields:

- `error`: object with a stable `code` and human-readable `message`.

Rules:

- Do not expose private absolute paths in public API errors.
- Keep detailed filesystem errors in server logs, not frontend payloads.

## Step-By-Step Implementation Plan

### 1. Add Shared Schemas

In `packages/shared`:

- Add schemas and types for workspace path input, note summary, successful list
  response, and safe API error response.
- Export them from the package index.
- Add tests for valid and invalid payloads.

Validation:

- Shared package typecheck passes.
- Shared package tests cover the expected shapes.

### 2. Resolve Workspace Roots Safely

In `packages/core`:

- Accept the user-provided workspace path.
- Resolve it to the true filesystem path with `realpath`.
- Verify the path exists.
- Verify the path is a directory.
- Return a domain-specific verified value such as `ResolvedWorkspaceRoot`.

Rules:

- Random strings remain untrusted.
- Only the verified workspace root type can be used by discovery code.
- Error messages should be clear and beginner-readable.

Tests:

- Accepts an existing directory.
- Rejects a missing path.
- Rejects a regular file.
- Normalizes equivalent paths to the same resolved root.

### 3. Protect The Workspace Boundary

In `packages/core`:

- Add helpers that verify a candidate file is inside the resolved workspace
  root.
- Reject or ignore anything that resolves outside the workspace.
- Do not follow symlinked directories in this slice.
- For symlinked files, resolve the real path and include the file only if it
  remains inside the workspace.

Why:

- Prevents path traversal such as `../../private-file`.
- Prevents symlinks from silently escaping the chosen workspace.
- Creates the safety model we will need before reading full files or writing
  edits.

Tests:

- Candidate paths outside the workspace are rejected.
- Symlinked directories are ignored.
- Symlinked files that point outside the workspace are ignored.
- Discovered note IDs never contain `..` path traversal segments.

### 4. Discover Markdown Files Recursively

In `packages/core`:

- Walk the workspace directory recursively.
- Include files ending in `.md`.
- Ignore non-markdown files.
- Ignore generated or configuration-heavy folders for this slice:
  - `.azurite`
  - `.git`
  - `.obsidian`
  - `node_modules`
- Return discovered files sorted by stable relative path.

Tests:

- Finds top-level `.md` files.
- Finds nested `.md` files.
- Ignores non-markdown files.
- Ignores skipped directories.
- Handles empty workspaces.
- Produces slash-separated relative paths.

### 5. Extract Note Titles With Markdown ASTs

In `packages/core`:

- Read each discovered markdown file.
- Parse markdown with `unified` and `remark-parse`.
- Traverse the AST for the first level-1 heading.
- Convert that heading to text with `mdast-util-to-string`.
- Fall back to the file name without `.md` when no level-1 heading exists.

Why:

- Avoids fragile title regexes.
- Starts the future indexing engine on the same AST foundation we will use for
  links, headings, tags, and markdown-aware behavior.

Tests:

- Uses the first `# Heading` as title.
- Ignores lower-level headings when no level-1 heading exists.
- Falls back to file name when no title heading exists.
- Handles empty markdown files.
- Handles headings with inline formatting.

### 6. Build Note Summaries

In `packages/core`:

- Combine path metadata, filesystem stats, and extracted title into note
  summaries.
- Return shared `NoteSummary` values.
- Keep absolute paths private inside core.

Tests:

- Includes `id`, `relativePath`, `fileName`, `title`, `lastModifiedAt`, and
  `sizeBytes`.
- Does not expose absolute paths.
- Sorts summaries by relative path.

### 7. Add Server Workspace Configuration

In `apps/server`:

- Read `AZURITE_WORKSPACE_PATH`.
- Do not crash the server when the variable is missing.
- Let `/api/notes` return a safe configuration error when no workspace path is
  configured.
- Keep the default bind host as `127.0.0.1`.

Tests:

- Missing workspace path returns a clear error from the route.
- Configured workspace path is passed to core discovery.

### 8. Add `GET /api/notes`

In `apps/server`:

- Add `GET /api/notes`.
- Resolve and validate the configured workspace path.
- Discover markdown notes with `packages/core`.
- Validate the response with `packages/shared` before returning it.
- Return safe errors for invalid workspace configuration or discovery failures.

Rules:

- Do not expose absolute paths in API responses.
- Keep route logic thin; core owns filesystem behavior.

Tests:

- Returns note summaries for a fixture workspace.
- Returns an empty note list for an empty workspace.
- Returns a safe error when workspace configuration is invalid.

### 9. Add Tiny Test Fixtures

Add small fixture workspaces under test directories.

Fixtures are sample files used by tests. They are not production data and should
stay tiny.

Example:

```text
test/fixtures/workspace/
  index.md
  Projects/
    Azurite.md
  ignored.txt
```

Rules:

- Keep fixtures small and obvious.
- Add only files needed to prove the current behavior.
- Do not create giant sample workspaces.

### 10. Validate The Slice

Run:

```bash
/opt/homebrew/bin/npx --yes pnpm@11.7.0 validate
/opt/homebrew/bin/npx --yes pnpm@11.7.0 build
```

Also manually confirm:

- The server route can list notes from a real temporary workspace.
- The response contains only relative note identifiers and safe metadata.
- Invalid workspace paths fail safely.

## Acceptance Criteria

The slice is complete when:

- `packages/core` can safely resolve a workspace root.
- `packages/core` can recursively discover `.md` files.
- Titles are extracted with the markdown AST pipeline.
- Note summaries do not expose absolute filesystem paths.
- `apps/server` exposes `GET /api/notes`.
- Missing or invalid workspace configuration returns a safe error.
- Tests cover discovery, title extraction, skipped folders, and path boundary
  protection.
- Validation and build commands pass.

## Next Slice After This

After this slice, the next natural slice is:

Read one note by ID, safely return its raw markdown, and render it in the web UI
with the approved sanitized markdown pipeline.
