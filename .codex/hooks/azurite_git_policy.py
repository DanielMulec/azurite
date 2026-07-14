#!/usr/bin/env python3
"""Codex hook enforcement for Azurite's primary-main Git policy."""

from __future__ import annotations

import fcntl
import json
import os
import sqlite3
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from azurite_worktree_policy import (
    PRIMARY_BRANCH,
    REPO_ROOT,
    WorktreeContext,
    WorktreePolicyFailure,
    command_policy_violation,
    ensure_controlled_layout,
    resolve_context,
)


EXPECTED_REMOTE = "git@github.com:DanielMulec/azurite.git"
LOCK_NAME = "codex-azurite-sync.lock"
SESSION_TITLE_PREFIX = "[Azurite] "


@dataclass
class RunResult:
    args: list[str]
    returncode: int
    stdout: str
    stderr: str


class HookFailure(Exception):
    pass


def run(args: list[str], cwd: Path, check: bool = True) -> RunResult:
    proc = subprocess.run(
        args,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    result = RunResult(args, proc.returncode, proc.stdout.strip(), proc.stderr.strip())
    if check and proc.returncode != 0:
        cmd = " ".join(args)
        detail = result.stderr or result.stdout or f"exit {proc.returncode}"
        raise HookFailure(f"`{cmd}` failed: {detail}")
    return result


def read_event() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HookFailure(f"hook stdin was not valid JSON: {exc}") from exc


def target_context(event: dict, include_tool_workdir: bool = False) -> WorktreeContext:
    base = Path(event.get("cwd") or os.getcwd()).expanduser().resolve()
    tool_input = event.get("tool_input") or {}
    raw_workdir = (
        tool_input.get("workdir") or tool_input.get("cwd")
        if include_tool_workdir
        else None
    )
    workdir = Path(raw_workdir).expanduser() if raw_workdir else base
    if not workdir.is_absolute():
        workdir = base / workdir
    try:
        return resolve_context(workdir.resolve())
    except WorktreePolicyFailure as exc:
        raise HookFailure(str(exc)) from exc


def ensure_origin(root: Path) -> None:
    origin = run(["git", "remote", "get-url", "origin"], root).stdout
    if origin != EXPECTED_REMOTE:
        raise HookFailure(f"Azurite expects origin `{EXPECTED_REMOTE}`, found `{origin}`")


def ensure_upstream(root: Path) -> None:
    upstream = run(
        ["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
        root,
        check=False,
    )
    if upstream.returncode != 0:
        run(["git", "branch", "--set-upstream-to=origin/main", PRIMARY_BRANCH], root)
        return
    if upstream.stdout != "origin/main":
        raise HookFailure(f"main must track `origin/main`, but tracks `{upstream.stdout}`")


def has_staged_changes(root: Path) -> bool:
    diff = run(["git", "diff", "--cached", "--quiet"], root, check=False)
    return diff.returncode == 1


def has_worktree_changes(root: Path) -> bool:
    return bool(run(["git", "status", "--porcelain"], root).stdout)


def rev_count(root: Path, revspec: str) -> int:
    result = run(["git", "rev-list", "--count", revspec], root)
    return int(result.stdout or "0")


def commit_if_needed(root: Path, worker: bool = False) -> bool:
    run(["git", "add", "-A"], root)
    if not has_staged_changes(root):
        return False
    run(
        [
            "git",
            "commit",
            "-m",
            "chore: checkpoint Codex worker" if worker else "chore: sync Azurite",
            "-m",
            (
                "Automated local checkpoint for primary-agent integration."
                if worker
                else "Automated Codex hook sync of the full outstanding main state."
            ),
        ],
        root,
    )
    return True


def sync_main(root: Path, require_workers_closed: bool) -> str:
    ensure_origin(root)
    try:
        ensure_controlled_layout(require_workers_closed)
    except WorktreePolicyFailure as exc:
        raise HookFailure(str(exc)) from exc
    run(["git", "fetch", "origin", PRIMARY_BRANCH], root)
    ensure_upstream(root)

    committed = commit_if_needed(root)

    behind = rev_count(root, "HEAD..origin/main")
    if behind:
        run(["git", "pull", "--rebase", "origin", PRIMARY_BRANCH], root)

    ahead = rev_count(root, "origin/main..HEAD")
    if ahead:
        run(["git", "push", "origin", PRIMARY_BRANCH], root)

    if has_worktree_changes(root):
        raise HookFailure("working tree is still dirty after sync")
    if rev_count(root, "origin/main..HEAD") or rev_count(root, "HEAD..origin/main"):
        raise HookFailure("local main and origin/main still differ after sync")

    if committed and ahead:
        return "committed and pushed full Azurite state to origin/main"
    if committed:
        return "committed full Azurite state; push was already up to date after rebase"
    if ahead:
        return "pushed existing local commits to origin/main"
    return "Azurite main already clean and synced"


def checkpoint_worker(root: Path) -> str:
    ensure_origin(root)
    committed = commit_if_needed(root, worker=True)
    if has_worktree_changes(root):
        raise HookFailure("controlled worker worktree is still dirty after checkpoint")
    return "checkpointed controlled worker state locally" if committed else "controlled worker state is clean"


def event_thread_id(event: dict) -> str | None:
    value = event.get("thread-id") or event.get("thread_id") or event.get("session_id")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def codex_state_db() -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex").expanduser()
    return Path(os.environ.get("CODEX_STATE_DB") or codex_home / "state_5.sqlite")


def newest_workspace_thread_id(connection: sqlite3.Connection, root: Path) -> str | None:
    row = connection.execute(
        "SELECT id FROM threads WHERE cwd = ? "
        "ORDER BY created_at_ms DESC, created_at DESC, id DESC LIMIT 1",
        (str(root),),
    ).fetchone()
    return row[0] if row else None


def prefix_session_title(event: dict, root: Path) -> str:
    try:
        with sqlite3.connect(str(codex_state_db()), timeout=5) as connection:
            connection.execute("PRAGMA busy_timeout = 5000")
            thread_id = event_thread_id(event) or newest_workspace_thread_id(connection, root)
            if not thread_id:
                return "no Codex thread found yet"

            row = connection.execute("SELECT title, cwd FROM threads WHERE id = ?", (thread_id,)).fetchone()
            if row is None:
                return "no matching Codex thread row found"

            title, cwd = row
            if Path(cwd).expanduser().resolve() != root:
                return "thread is outside Azurite workspace"

            title = title or ""
            if title.startswith(SESSION_TITLE_PREFIX):
                return "session title prefix already present"

            connection.execute("UPDATE threads SET title = ? WHERE id = ?", (SESSION_TITLE_PREFIX + title, thread_id))
            connection.commit()
            return "added session title prefix"
    except Exception as exc:  # noqa: BLE001
        return f"session title prefix skipped: {exc}"


def with_lock(_root: Path, callback) -> str:
    lock_path = REPO_ROOT / ".git" / LOCK_NAME
    with lock_path.open("w") as lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "another Azurite sync hook is already running"
        return callback()


def stop_success(message: str, title_message: str) -> None:
    print(json.dumps({"continue": True, "systemMessage": f"{message}; {title_message}", "suppressOutput": True}))


def session_success(message: str, title_message: str, is_primary: bool) -> None:
    policy = (
        "The primary worktree stays on main; controlled local codex/worktree/* "
        "worktrees are allowed, but only the primary integrates and pushes."
        if is_primary
        else "This is a controlled local worker; commit only assigned files and never push."
    )
    print(
        json.dumps(
            {
                "continue": True,
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": (
                        f"Azurite git policy is active: {policy} Latest hook check: {message}. "
                        f"Session title hook: {title_message}."
                    ),
                },
            }
        )
    )


def sync_failure(event_name: str, message: str, stop_hook_active: bool = False) -> None:
    if event_name == "Stop" and not stop_hook_active:
        print(
            json.dumps(
                {
                    "decision": "block",
                    "reason": (
                        "Azurite git sync failed. Resolve this before ending the turn: "
                        f"{message}"
                    ),
                }
            )
        )
        return
    print(json.dumps({"continue": False, "stopReason": message, "systemMessage": message}))


def guard(event: dict) -> None:
    context = target_context(event, include_tool_workdir=True)
    ensure_origin(context.root)
    tool_input = event.get("tool_input") or {}
    command = str(tool_input.get("command") or "")
    try:
        violation = command_policy_violation(command, context)
    except WorktreePolicyFailure as exc:
        raise HookFailure(str(exc)) from exc
    if violation:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            f"Azurite git policy: {violation}. The primary alone integrates and pushes main."
                        ),
                    }
                }
            )
        )
        return
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "additionalContext": (
                        "Azurite git policy remains active: controlled workers stay local; all successful "
                        "integrated writes must end with clean main pushed to origin/main."
                    ),
                }
            }
        )
    )


def sync(event: dict) -> None:
    context = target_context(event)
    root = context.root
    event_name = event.get("hook_event_name") or ""
    try:
        callback = (
            (lambda: sync_main(root, require_workers_closed=event_name == "Stop"))
            if context.is_primary
            else (lambda: checkpoint_worker(root))
        )
        message = with_lock(root, callback)
    except HookFailure as exc:
        sync_failure(event_name, str(exc), bool(event.get("stop_hook_active")))
        return

    if event_name == "SessionStart":
        session_success(message, prefix_session_title(event, root), context.is_primary)
    elif event_name == "Stop":
        stop_success(message, prefix_session_title(event, root))
    else:
        print(json.dumps({"continue": True, "systemMessage": message}))


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "sync"
    try:
        event = read_event()
        if mode == "guard":
            guard(event)
        elif mode == "sync":
            sync(event)
        else:
            raise HookFailure(f"unknown mode `{mode}`")
    except HookFailure as exc:
        print(json.dumps({"continue": False, "stopReason": str(exc), "systemMessage": str(exc)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
