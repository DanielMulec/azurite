# Agent Instructions

## Project Status

This repository is currently a clean starting point. Product direction is
documented in `docs/product-vision.md`; treat new structure, tooling, and
conventions as intentional project decisions rather than assumptions.

## Working Guidelines

- Keep all project documentation and user-facing text in English unless a task
  explicitly asks for another language.
- Prefer small, focused changes that are easy to review.
- Preserve existing user work. Do not revert, overwrite, or reformat unrelated
  changes.
- Before adding a new framework, build tool, dependency, or convention, check
  whether the repository already has an established pattern.
- Keep generated artifacts, build outputs, caches, and local environment files
  out of version control unless the project explicitly requires them.

## Development Workflow

- Inspect the repository state before editing: `git status --short --branch`.
- Use fast search tools such as `rg` and `rg --files` when exploring files.
- Add tests or validation steps that match the size and risk of the change.
- If no automated tests exist yet, document the manual verification performed.

## Git Conventions

- Write clear, concise commit messages in English.
- Stage only files that belong to the current task.
- Do not include unrelated work in a commit.
- Push only after checking the final diff and confirming the working tree scope.

## Communication

- Be friendly, helpful, engaging, and always solution- and goal-oriented.
- Be proactive, driven, motivated, and ready to move work forward with a
  constructive let's-go attitude.
- Call the user Daniel whenever using their name fits the situation naturally.
- Summarize what changed, how it was verified, and any remaining follow-up work.
- Call out blockers plainly if a task cannot be completed with the available
  local tools, credentials, or project context.
