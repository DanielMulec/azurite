# API Error Codes

## Purpose

Azurite API errors use stable machine-readable codes and human-readable
messages. Codes are product contracts: server routes, frontend states, tests,
and docs should reuse the same names instead of inventing local strings.

The source of truth in code is `apiErrorCodes` in `@azurite/shared`.

## Response Shape

```json
{
  "error": {
    "code": "invalid_note_id",
    "message": "Note ID must be a relative markdown path."
  }
}
```

Rules:

- `code` is stable and intended for branching in clients and tests.
- `message` is safe for users and must not expose private absolute filesystem
  paths.
- Detailed filesystem errors belong in server logs, not API responses.

## Current Codes

| Code                       | Typical HTTP status | Meaning                                                                                                           |
| -------------------------- | ------------------: | ----------------------------------------------------------------------------------------------------------------- |
| `workspace_not_configured` |                 500 | The local server has no configured workspace path.                                                                |
| `invalid_workspace`        |                 500 | The configured workspace path is missing, unreadable, or not a directory.                                         |
| `note_discovery_failed`    |                 500 | The server could not list workspace notes for an unexpected reason.                                               |
| `invalid_note_id`          |                 400 | The note ID is missing, malformed, absolute, unsafe, non-markdown, or points into an ignored workspace directory. |
| `note_not_found`           |                 404 | The note ID is valid, but no readable markdown file exists at that location.                                      |
| `note_read_failed`         |                 500 | The server could not read a note for an unexpected reason.                                                        |

## Current Users

- `GET /api/notes`
- `GET /api/notes/content?noteId=...`

See `docs/reference/api-routes.md` for the shared route constants.

## Maintenance Rules

- Add new API error codes to `@azurite/shared` before using them in server
  routes.
- Add or update tests when introducing a code.
- Keep this reference page aligned with the shared catalog.
- Prefer specific codes that describe the stable product state over temporary
  implementation details.
