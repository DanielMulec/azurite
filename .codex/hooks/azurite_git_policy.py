#!/usr/bin/env python3
"""Codex hook enforcement for the Azurite main-only git policy."""

from __future__ import annotations

import fcntl
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path("/Users/danielmulec/Projekte/azurite").resolve()
EXPECTED_BRANCH = "main"
EXPECTED_REMOTE = "git@github.com:DanielMulec/azurite.git"
LOCK_NAME = "codex-azurite-sync.lock"


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


def git_root(cwd: Path) -> Path:
    result = run(["git", "rev-parse", "--show-toplevel"], cwd)
    return Path(result.stdout).resolve()


def ensure_target_repo(event: dict) -> Path:
    cwd = Path(event.get("cwd") or os.getcwd()).resolve()
    root = git_root(cwd)
    if root != REPO_ROOT:
        raise HookFailure(f"expected Azurite root {REPO_ROOT}, got {root}")
    return root


def current_branch(root: Path) -> str:
    return run(["git", "branch", "--show-current"], root).stdout


def ensure_main(root: Path) -> None:
    branch = current_branch(root)
    if branch != EXPECTED_BRANCH:
        raise HookFailure(
            f"Azurite must stay on `{EXPECTED_BRANCH}`, but current branch is `{branch or '(detached)'}`"
        )


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
        run(["git", "branch", "--set-upstream-to=origin/main", EXPECTED_BRANCH], root)
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


def ensure_no_extra_local_branches(root: Path) -> None:
    output = run(
        ["git", "for-each-ref", "--format=%(refname:short)", "refs/heads"],
        root,
    ).stdout
    branches = [line.strip() for line in output.splitlines() if line.strip()]
    extras = [branch for branch in branches if branch != EXPECTED_BRANCH]
    if extras:
        raise HookFailure(
            "Azurite does not allow local side branches; remove these first: "
            + ", ".join(extras)
        )


def commit_if_needed(root: Path) -> bool:
    run(["git", "add", "-A"], root)
    if not has_staged_changes(root):
        return False
    run(
        [
            "git",
            "commit",
            "-m",
            "chore: sync Azurite",
            "-m",
            "Automated Codex hook sync of the full outstanding main state.",
        ],
        root,
    )
    return True


def sync_main(root: Path) -> str:
    ensure_main(root)
    ensure_origin(root)
    ensure_no_extra_local_branches(root)
    run(["git", "fetch", "origin", EXPECTED_BRANCH], root)
    ensure_upstream(root)

    committed = commit_if_needed(root)

    behind = rev_count(root, "HEAD..origin/main")
    if behind:
        run(["git", "pull", "--rebase", "origin", EXPECTED_BRANCH], root)

    ahead = rev_count(root, "origin/main..HEAD")
    if ahead:
        run(["git", "push", "origin", EXPECTED_BRANCH], root)

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


def with_lock(root: Path, callback) -> str:
    lock_path = root / ".git" / LOCK_NAME
    with lock_path.open("w") as lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "another Azurite sync hook is already running"
        return callback()


def stop_success(message: str) -> None:
    print(json.dumps({"continue": True, "systemMessage": message, "suppressOutput": True}))


def session_success(message: str) -> None:
    print(
        json.dumps(
            {
                "continue": True,
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "additionalContext": (
                        "Azurite git policy is active: stay on main, keep the full "
                        "repository state synced to origin/main, and do not create side branches. "
                        f"Latest hook check: {message}."
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


def is_branch_policy_violation(command: str) -> str | None:
    compact = re.sub(r"\s+", " ", command.strip())
    if not re.search(r"(^|[;&|()])\s*git\s+", compact):
        return None

    denied_patterns = [
        (r"\bgit\s+checkout\s+-b\b", "creating side branches is not allowed"),
        (r"\bgit\s+switch\s+-c\b", "creating side branches is not allowed"),
        (
            r"\bgit\s+branch\s+(?!(-[a-zA-Z-]+\s+)*(-r|-a|-vv?|--show-current)\b)",
            "branch management is not allowed",
        ),
        (r"\bgit\s+worktree\s+add\b", "additional worktrees are not allowed for this repo"),
        (r"\bgit\s+push\s+(-u\s+|--set-upstream\s+)", "pushing upstream branches is not allowed"),
    ]
    for pattern, reason in denied_patterns:
        if re.search(pattern, compact):
            return reason

    checkout_match = re.search(r"\bgit\s+(checkout|switch)\s+([^\s;&|()]+)", compact)
    if checkout_match:
        target = checkout_match.group(2)
        if target not in {EXPECTED_BRANCH, "--", "-"} and not target.startswith("-"):
            return "switching away from main is not allowed"

    push_match = re.search(r"\bgit\s+push(?:\s+([^\s;&|()]+))?(?:\s+([^\s;&|()]+))?", compact)
    if push_match:
        remote = push_match.group(1)
        branch = push_match.group(2)
        if remote and remote != "origin":
            return "push remote must be origin"
        if branch and branch not in {EXPECTED_BRANCH, "HEAD:main"}:
            return "push target must be main"

    return None


def guard(event: dict) -> None:
    root = ensure_target_repo(event)
    ensure_main(root)
    ensure_origin(root)
    tool_input = event.get("tool_input") or {}
    command = str(tool_input.get("command") or "")
    violation = is_branch_policy_violation(command)
    if violation:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            f"Azurite git policy: {violation}. Stay on main and sync to origin/main."
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
                        "Azurite git policy remains active: all successful writes must end "
                        "with the full main state pushed to origin/main."
                    ),
                }
            }
        )
    )


def sync(event: dict) -> None:
    root = ensure_target_repo(event)
    event_name = event.get("hook_event_name") or ""
    try:
        message = with_lock(root, lambda: sync_main(root))
    except HookFailure as exc:
        sync_failure(event_name, str(exc), bool(event.get("stop_hook_active")))
        return

    if event_name == "SessionStart":
        session_success(message)
    elif event_name == "Stop":
        stop_success(message)
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
