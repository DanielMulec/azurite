# Engineering Standards

## Purpose

These rules define how Azurite code is structured, reviewed, and verified. The
system architecture lives in `docs/technical-architecture.md`; this document
owns maintainability and implementation-quality policy.

## TypeScript And Module Design

- Use strict TypeScript across apps, packages, tests, and repository utilities.
- Keep `noImplicitAny` enabled and ban explicit `any`; use `unknown`, schemas,
  discriminated unions, generics, or specific domain types.
- Reuse existing schemas, inferred types, helpers, and domain functions before
  adding parallel shapes or near-copy logic.
- Extend shared behavior deliberately and test every supported context.
- Keep filesystem behavior in core, API contracts in shared, runtime handling in
  server, and browser/product UI behavior in web.
- Use TypeScript for repository utility scripts. Add `.mjs` only when an
  external preload or tooling boundary requires it, and document the exception.

## Readable Code Shape

- Keep every code file at 400 physical lines or fewer. Split by responsibility
  before the file reaches 401 lines.
- Keep functions small, control flow shallow, and names explicit.
- Treat complexity, nesting depth, parameter count, and function length as
  review signals. Refactor when they make the domain behavior difficult to
  understand; do not manufacture indirection merely to satisfy a metric.
- Prefer one clear responsibility per file and function.
- Use human, domain-oriented names instead of abbreviations.
- Document exported package APIs and externally meaningful app contracts with
  concise beginner-readable TSDoc.
- Comment non-obvious internal decisions and invariants; do not restate obvious
  code.

## ESLint Baseline

Use typed TypeScript linting, React rules, accessibility rules, and architecture
restrictions.

Type and async safety includes:

- `@typescript-eslint/no-explicit-any`
- the `no-unsafe-*` TypeScript ESLint rules
- `@typescript-eslint/no-floating-promises`
- `@typescript-eslint/no-misused-promises`
- `@typescript-eslint/no-non-null-assertion`
- `@typescript-eslint/strict-boolean-expressions`
- `@typescript-eslint/no-unnecessary-condition`
- `@typescript-eslint/switch-exhaustiveness-check`

General correctness includes `curly`, `eqeqeq`, `prefer-const`, `no-var`,
`no-eval`, and `no-implied-eval`.

React and accessibility includes:

- `react-hooks/rules-of-hooks`
- `react-hooks/exhaustive-deps`
- the recommended `jsx-a11y` rules

Use `no-restricted-imports` to protect monorepo boundaries. Add a dependency
graph tool only when import restrictions can no longer express circular or
feature-level constraints.

Do not enable noisy stylistic rules that fight Prettier. Any local lint disable
must explain why the rule is not appropriate at that location.

## Formatting

Prettier owns whitespace, indentation, wrapping, semicolons, quotes, trailing
commas, JSON, YAML, Markdown, CSS, and TypeScript formatting. ESLint owns
correctness, safety, architecture, accessibility, and maintainability.

## Security And Validation

- Validate untrusted input and output at runtime with shared schemas.
- Treat markdown as untrusted data.
- Keep raw HTML disabled unless a focused capability defines sanitization and
  tests the allowed schema.
- Restrict `dangerouslySetInnerHTML` to an approved sanitized renderer.
- Restrict filesystem reads and writes to the selected cluster boundary.
- Test path traversal, unsafe symlinks, malicious markdown, unsupported HTML,
  API validation failures, and write conflicts where relevant.
- Preserve origin checks or CSRF protection for state-changing routes.
- Keep frontend production console use restricted while preserving structured
  server logging.

## Testing And Verification

Match verification to the change's blast radius.

- Unit-test domain behavior and shared contracts.
- Integration-test API routes, filesystem boundaries, persistence behavior, and
  state ownership.
- Use real browser QA for rendering, editor behavior, history, IndexedDB,
  lifecycle, and responsive behavior.
- Use physical-device QA for Android/Tailscale behavior that desktop automation
  cannot prove.
- Verify both the new behavior and the shared and slice-specific product
  guardrails.
- If automated coverage is unavailable, record the exact manual verification.

The full repository validation command is:

```sh
/opt/homebrew/bin/pnpm validate
```

## Dependency Decisions

Before adding a framework, package, storage layer, or convention:

1. Check the existing repository pattern and reusable code.
2. State the long-term product capability the dependency will own.
3. Compare relevant dependency categories, not only individual packages.
4. Verify current compatibility and important runtime behavior.
5. Record reusable primary sources in the research catalog.

Do not avoid a necessary dependency merely to keep a slice superficially small.
Do not install a platform opportunistically before its product role exists.

## Repository Hygiene

- Preserve unrelated user changes.
- Keep generated output, caches, and local environment files out of version
  control unless the product explicitly requires them.
- Stage and commit only files belonging to the current task.
- Keep successful repository writes on `main` and synchronize the full state
  with `origin/main`.
