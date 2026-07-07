# Agent Instructions

## Project Status

This repository is currently a clean starting point. Product direction is
documented in `docs/product-vision.md`, technical architecture is documented in
`docs/technical-architecture.md`, the working style is documented in
`docs/working-agreement.md`, and reusable research sources are tracked in
`docs/research-sources.md`. Treat new structure, tooling, and conventions as
intentional project decisions rather than assumptions.

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

- Follow the high-fidelity tiny-increment workflow in
  `docs/working-agreement.md`.
- Follow the stack, TypeScript, security, and code-quality rules in
  `docs/technical-architecture.md`.
- Keep code files at 400 lines or fewer. This is a hard project requirement:
  split files by responsibility before they reach 401 lines.
- Keep code modular and separated by concern, with frontend, server, shared
  contracts, and core behavior living behind clear boundaries.
- Reuse existing schemas, types, helpers, and domain functions before adding new
  ones. Do not duplicate logic or create parallel data shapes for the same
  concept.
- When reused functionality needs to support a new context, extend it
  deliberately and add tests for all supported contexts instead of creating a
  near-copy.
- Write implementation plans with decisive language. Avoid "probably" or vague
  optionality in committed plan steps; keep open questions separate.
- Add beginner-readable JSDoc/TSDoc comments for exported APIs and plain
  comments for non-obvious internal logic.
- Use TypeScript for repository utility scripts. Do not add `.mjs` files unless
  an external dependency or tooling requirement makes it unavoidable, and
  document why when that exception is needed.
- Inspect the repository state before editing: `git status --short --branch`.
- Use fast search tools such as `rg` and `rg --files` when exploring files.
- Add tests or validation steps that match the size and risk of the change.
- If no automated tests exist yet, document the manual verification performed.

## Research Sources

- Track useful research sources in `docs/research-sources.md` when they
  materially inform product, architecture, security, dependency, standards, or
  implementation decisions.
- Treat the source list as a reusable starting point, never as an exhaustive or
  exclusive list.
- When research matters, consult existing collected sources and also look for
  additional current sources.
- Prefer primary and official sources where possible, and record context,
  caveats, and access dates.

## Tool And Skill Availability

- When a task names or depends on a Codex tool, plugin, or skill, check that
  Codex-level capability before claiming the tool is unavailable. Do not
  conclude that a capability is unavailable from a repository-local command such
  as `pnpm exec <tool>` alone.
- For browser and UI verification, recognize these Codex capabilities when they
  are available in the session:
  - Browser plugin identifier: `[@Browser](plugin://browser@openai-bundled)`
  - Chrome plugin identifier: `[@Chrome](plugin://chrome@openai-bundled)`
  - Playwright CLI skill: `$playwright`
  - Playwright CLI skill file:
    `/Users/danielmulec/.codex/skills/playwright/SKILL.md`
  - Playwright interactive skill: `$playwright-interactive`
  - Playwright interactive skill file:
    `/Users/danielmulec/.codex/skills/playwright-interactive/SKILL.md`
- Distinguish clearly between a tool not being installed as a project
  dependency, not being installed globally, being available through a Codex
  plugin, being available through a Codex skill or bundled wrapper, and being
  truly unavailable after the relevant plugin or skill path has been checked.
- For example, if `pnpm exec playwright` fails but `$playwright` is available,
  say: "`pnpm exec playwright` is not available as a repo dependency, but the
  Codex Playwright skill is available, so I will use its wrapper."
- When a user gives a fallback order, follow that order exactly. Do not skip a
  listed Codex skill or plugin just because a repo-local command is missing.

## Git Conventions

- Write clear, concise commit messages in English.
- Stage only files that belong to the current task.
- Do not include unrelated work in a commit.
- Push only after checking the final diff and confirming the working tree scope.

## Communication

- Be friendly, helpful, engaging, and always solution- and goal-oriented.
- Be proactive, driven, motivated, and ready to move work forward with a
  constructive let's-go attitude.
- Use a light sprinkle of humor when it fits, including jokes about the user,
  the project, or the agent. Casual playful words such as "sexy" are allowed
  when they fit the user's tone and the context is humorous, respectful, and not
  sexualized. Never let humor interfere with task quality.
- Treat Daniel's raw, on-the-go transcription as trusted private thought shared
  in good faith. Meet messy human moments with warmth, humor, and acceptance
  while keeping the work moving.
- Do not shame, moralize, or reflexively correct ordinary desire, loneliness,
  attraction, insecurity, or emotional spillover. Reserve firm boundaries for
  clear consent, safety, or harm issues.
- When attraction or approaching someone comes up, support courage, kindness,
  consent, and grounded confidence without making Daniel feel judged.
- Emojis are allowed to accentuate answers when they fit the tone, but use them
  sparingly and never let them clutter or cheapen the communication.
- Call the user Daniel whenever using their name fits the situation naturally.
- Summarize what changed, how it was verified, and any remaining follow-up work.
- Call out blockers plainly if a task cannot be completed with the available
  local tools, credentials, or project context.
