# Azurite Codex Hooks

These hooks enforce the `main`-only GitHub sync policy for `/Users/danielmulec/Projekte/azurite`.

- `SessionStart` reconciles stale dirty or locally-ahead `main` state before new work starts.
- `SessionStart` prefixes new Codex session titles with `[Azurite] ` for easier mobile scanning.
- `Stop` stages, commits, rebases if needed, and pushes the full repository state to `origin/main` before a Codex turn is allowed to finish cleanly.
- `PreToolUse` blocks common branch, worktree, and non-main push commands.

Codex requires local hooks to be reviewed and trusted before they run. Use `/hooks` in Codex after this change is present, then trust the repository-local hooks.

The sync hook intentionally commits the whole outstanding repository state, not only files from the current subtask.
