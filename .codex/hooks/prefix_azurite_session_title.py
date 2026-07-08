#!/usr/bin/env python3
"""Prefix new Codex session titles for the Azurite workspace."""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path


WORKSPACE = Path("/Users/danielmulec/Projekte/azurite").resolve()
PREFIX = "[Azurite] "
DEFAULT_CODEX_HOME = Path.home() / ".codex"


def read_event() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME") or DEFAULT_CODEX_HOME).expanduser()


def current_cwd(event: dict) -> Path:
    return Path(event.get("cwd") or os.getcwd()).expanduser().resolve()


def event_thread_id(event: dict) -> str | None:
    value = event.get("thread-id") or event.get("thread_id") or event.get("session_id")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def connect_state_db(home: Path) -> sqlite3.Connection:
    db_path = Path(os.environ.get("CODEX_STATE_DB") or home / "state_5.sqlite")
    connection = sqlite3.connect(str(db_path), timeout=5)
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def newest_workspace_thread_id(connection: sqlite3.Connection) -> str | None:
    row = connection.execute(
        """
        SELECT id
        FROM threads
        WHERE cwd = ?
        ORDER BY created_at_ms DESC, created_at DESC, id DESC
        LIMIT 1
        """,
        (str(WORKSPACE),),
    ).fetchone()
    return row[0] if row else None


def prefix_thread_title(connection: sqlite3.Connection, thread_id: str) -> str:
    row = connection.execute(
        "SELECT title, cwd FROM threads WHERE id = ?",
        (thread_id,),
    ).fetchone()
    if row is None:
        return "no matching Codex thread row found"

    title, cwd = row
    if Path(cwd).expanduser().resolve() != WORKSPACE:
        return "thread is outside Azurite workspace"

    title = title or ""
    if title.startswith(PREFIX):
        return "Azurite prefix already present"

    connection.execute(
        "UPDATE threads SET title = ? WHERE id = ?",
        (PREFIX + title, thread_id),
    )
    connection.commit()
    return "added Azurite prefix to session title"


def success(message: str) -> None:
    print(
        json.dumps(
            {
                "continue": True,
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": f"Azurite session title hook: {message}.",
                },
            }
        )
    )


def main() -> int:
    event = read_event()
    if current_cwd(event) != WORKSPACE:
        success("skipped outside Azurite workspace")
        return 0

    with connect_state_db(codex_home()) as connection:
        thread_id = event_thread_id(event) or newest_workspace_thread_id(connection)
        if not thread_id:
            success("no Azurite thread found yet")
            return 0
        message = prefix_thread_title(connection, thread_id)
        success(message)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
