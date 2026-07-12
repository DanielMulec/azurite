"""Read-only Codex title synchronization context for Azurite hooks."""

from __future__ import annotations

from contextlib import closing
import os
import sqlite3
from pathlib import Path


def native_title_sync_context(
    event: dict,
    root: Path,
    title_prefix: str,
    state_db: Path | None = None,
) -> str:
    """Return developer context that asks Codex to apply a native thread rename.

    The context intentionally tells the active agent to use the desktop title tool.
    Reading the SQLite state identifies the desired title, but this helper never
    writes that database because only the native action updates the live sidebar.
    """
    thread_id = current_thread_id(event)
    if thread_id is None:
        return "Codex title synchronization skipped: hook did not receive a session ID."

    try:
        database_uri = (state_db or codex_state_db()).resolve().as_uri() + "?mode=ro"
        with closing(sqlite3.connect(database_uri, uri=True, timeout=5)) as connection:
            connection.execute("PRAGMA busy_timeout = 5000")
            row = connection.execute(
                "SELECT title, cwd FROM threads WHERE id = ?", (thread_id,)
            ).fetchone()
    except sqlite3.Error as exc:
        return f"Codex title synchronization skipped: could not read state: {exc}."

    if row is None:
        return "Codex title synchronization skipped: no matching Codex thread exists yet."

    title, cwd = row
    if Path(cwd).expanduser().resolve() != root:
        return "Codex title synchronization skipped: thread is outside Azurite."

    title = str(title or "").strip()
    if not title:
        return "Codex title synchronization skipped: the thread has no title yet."

    desired_title = title if title.startswith(title_prefix) else title_prefix + title
    return (
        "Codex live title synchronization is required before other work. Use the native "
        "`codex_app__set_thread_title` tool with this exact title: "
        f"{desired_title!r}. Omit `threadId` so it targets this active task. Do not edit "
        "Codex's SQLite database. If that native tool is unavailable, continue normally."
    )


def current_thread_id(event: dict) -> str | None:
    """Read the active Codex session identifier from a hook event."""
    value = event.get("thread-id") or event.get("thread_id") or event.get("session_id")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def codex_state_db() -> Path:
    """Return the Codex state database path while honoring local overrides."""
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return Path(os.environ.get("CODEX_STATE_DB") or codex_home / "state_5.sqlite")
