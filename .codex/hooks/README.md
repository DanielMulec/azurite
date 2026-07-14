# Azurite Codex Hooks

These hooks enforce Azurite's primary-`main` GitHub sync policy and the
controlled local editing-worktree contract whose authoritative instructions
live in `agents.md`.

- `SessionStart` reconciles stale dirty or locally-ahead `main` state before new work starts.
- `SessionStart` and `Stop` prefix Codex session titles with `[Azurite] ` for easier mobile scanning. `Stop` repeats the check because Codex can generate or overwrite the readable title after startup.
- `Stop` checkpoints a worker locally without pushing. In the primary worktree,
  it requires all workers to be integrated and removed, then stages, commits,
  rebases if needed, and pushes the full repository state to `origin/main`
  before a Codex turn is allowed to finish cleanly.
- `PreToolUse` permits only `codex/worktree/<slug>` branches in matching linked
  worktrees under `/Users/danielmulec/Projekte/azurite-worktrees/<slug>`. It
  blocks worker pushes, arbitrary branch/worktree commands, primary branch
  switches, and non-main pushes.

Codex requires local hooks to be reviewed and trusted before they run. Use `/hooks` in Codex after this change is present, then trust the repository-local hooks.

The primary sync hook intentionally commits the whole outstanding repository
state, not only files from the current subtask. Worker checkpoints stay local
for primary-agent review and integration.

The dependency-free Python implementation is retained because these Codex hooks
must run before the Node workspace or project dependencies are available.
