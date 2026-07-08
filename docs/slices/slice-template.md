# Slice N: Title

## Status

Proposed.

## Product Decision

State the product decision this slice settles.

## User Story

When the user does something, Azurite should provide a complete, dependable
workflow that matters for the product.

## Goals

- New capability this slice makes possible.
- Product behavior this slice completes.
- Architecture or foundation this slice establishes.

## Non-Goals

- Related behavior deliberately left out of this slice.
- Future work that should not be smuggled into this implementation.

## Implementation Plan

### 1. Step Name

Implementation requirements:

- Concrete behavior, data shape, route, state, UI, or test requirement.

## Negative Side-Effect Guardrails

This slice must preserve the existing product and engineering guarantees it
touches.

Guardrails:

- Existing user workflows that must keep working.
- Existing persistence, save, recovery, deletion, or migration guarantees that
  must not regress.
- Existing validation, security, privacy, and filesystem boundaries that must
  not weaken.
- Existing URL, browser history, client state, cache, or storage behavior that
  must stay coherent.
- Existing degraded, error, and recovery states that must remain visible.
- Existing tests, manual QA flows, browser checks, or device checks that must
  still pass after the change.

The implementation must not silently delete user data, create duplicate sources
of truth, weaken shared contracts, hide failures, or leave stale async work in
fake loading, failed, or conflict states.

## Verification Plan

Run the full repository validation:

```sh
/opt/homebrew/bin/pnpm validate
```

Add slice-specific tests and manual QA steps here.

## Acceptance Criteria

- The new user story works end to end.
- The architecture or product decision named above is represented in code,
  tests, docs, or a deliberate decision note.
- The negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.
