# API Routes

## Purpose

Azurite API route paths are product contracts. Server handlers, frontend
clients, tests, and docs should reuse the same route names instead of retyping
paths locally.

The source of truth in code is `apiRoutes` and `apiQueryParameters` in
`@azurite/shared`.

## Current Routes

| Route constant          | Method | Path                 | Purpose                                                     |
| ----------------------- | ------ | -------------------- | ----------------------------------------------------------- |
| `apiRoutes.health`      | `GET`  | `/health`            | Reports local server health and version metadata.           |
| `apiRoutes.notes`       | `GET`  | `/api/notes`         | Lists markdown note summaries for the configured workspace. |
| `apiRoutes.noteContent` | `GET`  | `/api/notes/content` | Reads one markdown note by workspace-relative note ID.      |

## Query Parameters

| Parameter constant          | Name     | Used by                  | Purpose                                        |
| --------------------------- | -------- | ------------------------ | ---------------------------------------------- |
| `apiQueryParameters.noteId` | `noteId` | `GET /api/notes/content` | Selects a workspace-relative markdown note ID. |

## URL Builders

Use `createNoteContentRoute(noteId)` to build note-content request URLs. The
helper encodes note IDs so slash-separated relative note IDs can safely travel
through the query string.

Example:

```ts
createNoteContentRoute("Projects/azurite.md");
```

returns:

```text
/api/notes/content?noteId=Projects%2Fazurite.md
```

## Maintenance Rules

- Add new stable API paths to `@azurite/shared` before using them in server or
  frontend code.
- Add a URL builder when a route requires query parameters.
- Keep route constants free of host, port, and protocol details.
- Keep this reference page aligned with the shared route catalog.
