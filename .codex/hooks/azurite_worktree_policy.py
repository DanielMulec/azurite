#!/usr/bin/env python3
"""Validate Azurite's controlled local worktree policy."""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path("/Users/danielmulec/Projekte/azurite").resolve()
PRIMARY_BRANCH = "main"
WORKER_BRANCH_PREFIX = "codex/worktree/"
WORKTREE_PARENT = REPO_ROOT.parent / "azurite-worktrees"
WORKER_SLUG = r"[a-z0-9][a-z0-9._-]*"


class WorktreePolicyFailure(Exception):
    pass


@dataclass(frozen=True)
class WorktreeContext:
    root: Path
    branch: str
    is_primary: bool


def git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or f"exit {result.returncode}"
        raise WorktreePolicyFailure(f"`git {' '.join(args)}` failed: {detail}")
    return result


def git_path(raw: str, cwd: Path) -> Path:
    path = Path(raw.strip())
    return path.resolve() if path.is_absolute() else (cwd / path).resolve()


def is_direct_child(path: Path, parent: Path) -> bool:
    return path.parent == parent.resolve()


def valid_worker_branch(branch: str) -> bool:
    return re.fullmatch(rf"{re.escape(WORKER_BRANCH_PREFIX)}{WORKER_SLUG}", branch) is not None


def validate_worker(root: Path, branch: str) -> None:
    if not is_direct_child(root, WORKTREE_PARENT):
        raise WorktreePolicyFailure(f"worker worktrees must be direct children of `{WORKTREE_PARENT}`")
    if not valid_worker_branch(branch):
        raise WorktreePolicyFailure(
            f"worker branch `{branch or '(detached)'}` must use `{WORKER_BRANCH_PREFIX}<slug>`"
        )
    if root.name != branch.removeprefix(WORKER_BRANCH_PREFIX):
        raise WorktreePolicyFailure("worker worktree directory and branch slugs must match")
    upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], root, check=False)
    if upstream.returncode == 0:
        raise WorktreePolicyFailure("temporary worker branches must not have an upstream")


def resolve_context(cwd: Path) -> WorktreeContext:
    root_result = git(["rev-parse", "--show-toplevel"], cwd)
    root = Path(root_result.stdout.strip()).resolve()
    common_raw = git(["rev-parse", "--git-common-dir"], cwd).stdout
    common = git_path(common_raw, root)
    if common != (REPO_ROOT / ".git").resolve():
        raise WorktreePolicyFailure(f"expected Azurite Git directory `{REPO_ROOT / '.git'}`, got `{common}`")

    branch = git(["branch", "--show-current"], root).stdout.strip()
    if root == REPO_ROOT:
        if branch != PRIMARY_BRANCH:
            raise WorktreePolicyFailure(
                f"the primary Azurite worktree must stay on `{PRIMARY_BRANCH}`, got `{branch or '(detached)'}`"
            )
        return WorktreeContext(root, branch, True)

    validate_worker(root, branch)
    return WorktreeContext(root, branch, False)


def parse_worktrees() -> list[tuple[Path, str]]:
    records: list[tuple[Path, str]] = []
    path: Path | None = None
    branch = ""
    output = git(["worktree", "list", "--porcelain"], REPO_ROOT).stdout
    for line in [*output.splitlines(), ""]:
        if line.startswith("worktree "):
            path = Path(line.removeprefix("worktree ")).resolve()
        elif line.startswith("branch refs/heads/"):
            branch = line.removeprefix("branch refs/heads/")
        elif not line and path is not None:
            records.append((path, branch))
            path, branch = None, ""
    return records


def ensure_controlled_layout(require_closed: bool) -> None:
    workers: list[str] = []
    for path, branch in parse_worktrees():
        if path == REPO_ROOT:
            if branch != PRIMARY_BRANCH:
                raise WorktreePolicyFailure("the primary worktree is not registered on `main`")
            continue
        validate_worker(path, branch)
        workers.append(branch)

    local_output = git(
        ["for-each-ref", "--format=%(refname:short)", "refs/heads"],
        REPO_ROOT,
    ).stdout
    local_workers = [line for line in local_output.splitlines() if line and line != PRIMARY_BRANCH]
    if sorted(local_workers) != sorted(workers):
        raise WorktreePolicyFailure(
            "every local side branch must be a checked-out controlled worker branch; "
            f"registered={sorted(workers)}, local={sorted(local_workers)}"
        )
    if require_closed and workers:
        raise WorktreePolicyFailure(
            "integrate and remove controlled worker worktrees before finishing: " + ", ".join(sorted(workers))
        )


def ready_for_worker() -> bool:
    if git(["status", "--porcelain"], REPO_ROOT).stdout.strip():
        return False
    ahead = git(["rev-list", "--count", "origin/main..HEAD"], REPO_ROOT).stdout.strip()
    behind = git(["rev-list", "--count", "HEAD..origin/main"], REPO_ROOT).stdout.strip()
    return ahead == "0" and behind == "0"


def canonical_worker_add(command: str) -> bool:
    match = re.search(
        rf"\bgit\s+worktree\s+add\s+-b\s+({re.escape(WORKER_BRANCH_PREFIX)}({WORKER_SLUG}))\s+([^\s;&|()]+)\s+main(?=$|[\s;&|()])",
        command,
    )
    if not match:
        return False
    path = Path(match.group(3)).expanduser().resolve()
    return is_direct_child(path, WORKTREE_PARENT) and path.name == match.group(2)


def branch_command_violation(command: str, context: WorktreeContext) -> str | None:
    for match in re.finditer(r"\bgit\s+branch\b([^;&|()]*)", command):
        args = match.group(1).strip().split()
        if not args or args[0] in {"--show-current", "--list", "-a", "-r", "-v", "-vv"}:
            continue
        if (
            context.is_primary
            and len(args) == 2
            and args[0] in {"-d", "-D", "--delete"}
            and valid_worker_branch(args[1])
        ):
            continue
        return "branch management is limited to deleting integrated controlled worker branches"
    return None


def command_policy_violation(command: str, context: WorktreeContext) -> str | None:
    compact = re.sub(r"\s+", " ", command.strip())
    if not re.search(r"(^|[;&|()])\s*git\s+", compact):
        return None
    if re.search(r"\bgit\s+-C\b", compact):
        return "use the tool working directory instead of `git -C` so worktree policy remains inspectable"

    if re.search(r"\bgit\s+worktree\s+add\b", compact):
        if not context.is_primary or not canonical_worker_add(compact):
            return "worker creation must use the canonical local worktree path, branch prefix, and `main` baseline"
        if len(re.findall(r"\bgit\s+worktree\s+add\b", compact)) != 1 or not ready_for_worker():
            return "create one worker at a time from clean `main` synchronized with `origin/main`"

    for match in re.finditer(r"\bgit\s+worktree\s+(remove|move|lock|unlock)\b([^;&|()]*)", compact):
        operation, raw_args = match.groups()
        args = raw_args.strip().split()
        if operation != "remove" or not context.is_primary or len(args) != 1:
            return "only the primary may remove a controlled worker worktree"
        if not is_direct_child(Path(args[0]).expanduser().resolve(), WORKTREE_PARENT):
            return "worker removal is restricted to the canonical Azurite worktree directory"

    violation = branch_command_violation(compact, context)
    if violation:
        return violation
    if re.search(r"\bgit\s+(checkout\s+-b|switch\s+-c)\b", compact):
        return "create temporary branches only through the canonical `git worktree add -b` command"
    for match in re.finditer(r"\bgit\s+(checkout|switch)\s+([^\s;&|()]+)", compact):
        if not context.is_primary or match.group(2) != PRIMARY_BRANCH:
            return "the primary stays on `main` and worker branches stay attached to their worktrees"

    for match in re.finditer(r"\bgit\s+push\b([^;&|()]*)", compact):
        args = match.group(1).strip().split()
        if not context.is_primary or args not in ([], ["origin", "main"]):
            return "only the primary worktree may push `main` to `origin`"
    return None
