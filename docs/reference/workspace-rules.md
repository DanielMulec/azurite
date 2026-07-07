# Workspace And Note Rules

## Purpose

Azurite treats markdown files as the source of truth for knowledge content.
Workspace and note rules define which files count as notes, how note IDs are
formed, and which workspace paths are reserved for metadata or external tools.

The main code source of truth is `@azurite/shared`.

## Markdown Notes

Current supported note extension:

```text
.md
```

The shared source of truth is `markdownNoteFileExtension`.

Rules:

- Markdown notes must use the `.md` file extension.
- Raw markdown is returned as data when reading note content.
- Rendered HTML belongs to a later sanitized rendering slice.

## Note IDs

Note IDs are slash-separated paths relative to the configured workspace root.

Valid examples:

```text
index.md
Projects/azurite.md
Daily/2026-07-07.md
```

Rules:

- Must be non-empty.
- Must end in `.md`.
- Must use `/` separators.
- Must not be an absolute path.
- Must not contain `.` segments.
- Must not contain `..` segments.
- Must not contain empty path segments such as `foo//bar.md`.
- Must not enter ignored workspace directories.
- Must not expose or accept private absolute filesystem paths.

## Note Metadata

Current note metadata fields:

- `id`
- `relativePath`
- `fileName`
- `title`
- `lastModifiedAt`
- `sizeBytes`

Current rule:

- `id` and `relativePath` are the same slash-separated workspace-relative path.

## Ignored Workspace Directories

Current ignored directory names:

```text
.azurite
.git
.obsidian
node_modules
```

The shared source of truth is `ignoredWorkspaceDirectoryNames`.

Rules:

- Note discovery skips these directories.
- Note-content reads reject note IDs inside these directories.
- The ignored list protects generated state, Git metadata, Obsidian metadata,
  and dependency folders from being treated as Azurite notes.

## Maintenance Rules

- Add workspace/note contract changes to `@azurite/shared` before relying on
  them in core, server, frontend, or tests.
- Keep this reference page aligned with shared schemas and constants.
- Keep user knowledge workspaces decoupled from this source repository.
