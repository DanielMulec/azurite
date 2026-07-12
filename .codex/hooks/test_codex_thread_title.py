"""Tests for the read-only native Codex title synchronization context."""

from __future__ import annotations

from contextlib import closing
import sqlite3
import tempfile
import unittest
from pathlib import Path

from codex_thread_title import native_title_sync_context


class NativeTitleSyncContextTests(unittest.TestCase):
    """Verify title context is precise and never needs a database write."""

    def setUp(self) -> None:
        self.root = Path("/Users/danielmulec/Projekte/azurite")
        self.temp_dir = tempfile.TemporaryDirectory()
        self.state_db = Path(self.temp_dir.name) / "state.sqlite"
        with closing(sqlite3.connect(self.state_db)) as connection:
            connection.execute("CREATE TABLE threads (id TEXT, title TEXT, cwd TEXT)")
            connection.commit()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def add_thread(self, title: str | None, cwd: Path | None = None) -> None:
        with closing(sqlite3.connect(self.state_db)) as connection:
            connection.execute(
                "INSERT INTO threads VALUES (?, ?, ?)",
                ("thread-1", title, str(cwd or self.root)),
            )
            connection.commit()

    def test_requests_native_rename_with_prefixed_title(self) -> None:
        self.add_thread("Refresh Codex thread list")

        context = native_title_sync_context(
            {"session_id": "thread-1"}, self.root, "[Azurite] ", self.state_db
        )

        self.assertIn("codex_app__set_thread_title", context)
        self.assertIn("'[Azurite] Refresh Codex thread list'", context)
        self.assertIn("Omit `threadId`", context)

    def test_keeps_existing_prefix(self) -> None:
        self.add_thread("[Azurite] Refresh Codex thread list")

        context = native_title_sync_context(
            {"session_id": "thread-1"}, self.root, "[Azurite] ", self.state_db
        )

        self.assertEqual(context.count("[Azurite]"), 1)

    def test_never_writes_the_state_database(self) -> None:
        self.add_thread("Refresh Codex thread list")

        native_title_sync_context(
            {"session_id": "thread-1"}, self.root, "[Azurite] ", self.state_db
        )

        with closing(sqlite3.connect(self.state_db)) as connection:
            title = connection.execute(
                "SELECT title FROM threads WHERE id = ?", ("thread-1",)
            ).fetchone()[0]
        self.assertEqual(title, "Refresh Codex thread list")

    def test_skips_threads_outside_the_workspace(self) -> None:
        self.add_thread("Elsewhere", Path("/tmp/elsewhere"))

        context = native_title_sync_context(
            {"session_id": "thread-1"}, self.root, "[Azurite] ", self.state_db
        )

        self.assertEqual(context, "Codex title synchronization skipped: thread is outside Azurite.")

    def test_skips_missing_or_empty_titles(self) -> None:
        self.add_thread(None)

        context = native_title_sync_context(
            {"session_id": "thread-1"}, self.root, "[Azurite] ", self.state_db
        )

        self.assertEqual(
            context,
            "Codex title synchronization skipped: the thread has no title yet.",
        )
