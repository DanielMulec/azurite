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

## Future Workflow Boundary

Include this section for cross-cutting foundations. Omit it for isolated,
reversible work whose workflow boundary is already obvious.

| Boundary               | Decision                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| Current workflow       | End-to-end workflow completed by this slice.                      |
| Predictable extensions | Near-term workflows that shape today's architecture.              |
| Participating layers   | Product layers that own current behavior.                         |
| Near-term seams        | Interfaces required now for those predictable extensions.         |
| Exclusions             | Deliberately excluded layers and the stable reason they can wait. |

## Implementation Plan

### 1. Step Name

Implementation requirements:

- Concrete behavior, data shape, route, state, UI, or test requirement.

## Negative Side-Effect Guardrails

Baseline: `docs/reference/product-guardrails.md`.

List only risks introduced by this slice that need more specific protection than
the shared baseline:

- Concrete new failure mode and the behavior that prevents it.
- New degraded state that must remain visible.
- New migration, integration, or performance guarantee that requires targeted
  regression proof.

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
