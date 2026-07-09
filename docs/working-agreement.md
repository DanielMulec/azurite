# Working Agreement

## High-Fidelity Product Slices

Azurite should be built in coherent, high-quality product and engineering
slices. A slice is a delivery unit that lets the user do something new, do an
existing thing meaningfully better, or removes a meaningful blocker, risk, or
architectural limitation.

A good slice can be reviewed and verified, but its boundary is defined by the
user story, engineering outcome, or product capability it completes.
Reviewability shapes execution; it does not shrink the slice below the natural
workflow boundary.

When a feature touches behavior inspired by Obsidian, Notion, markdown tools,
LSPs, PWAs, or security-sensitive local hosting, fidelity matters. Research
should be deep enough for the selected slice to be excellent, not merely
plausible.

## Research Scope

Research should be scoped, not rushed.

- Do not time-box research in a way that risks shallow or inaccurate behavior.
- Do not expand one feature into a broad research phase for the entire product.
- Research the selected delivery unit deeply enough to make a strong
  implementation decision.
- Convert research into one or more concrete outputs: code, tests, a short
  decision note, a source entry, or a clearly documented follow-up.
- Track reusable sources in `docs/research-sources.md`, while still looking for
  additional current sources when research matters.

## Slice Selection

Prefer slices that produce visible, testable, or enabling product progress.

A slice should complete at least one real user story or product capability. Some
slices are user-facing features; others are refactors, foundations, tooling, or
quality improvements that unlock user-facing work or remove current product
pain.

A slice should span every product layer required to complete the user story
honestly: frontend UI, client state, URL state, browser storage, IndexedDB,
backend routes, shared contracts, filesystem behavior, databases, tests,
documentation, tooling, and development workflow. If a layer participates in the
current workflow or is predictably required by the capability being established,
include it in the candidate scope first. Exclude it only when the exclusion forms
a stable, useful delivery boundary and does not create immediate follow-up work
for the same user story.

Do not split a slice just because part of it can be implemented separately.
Split only when each side is a stable, useful delivery unit.

A slice is too small when it proves an implementation detail but leaves the user
story unfinished, knowingly preserves a broken workflow, or creates immediate
follow-up work that is already required for the behavior to be usable.

## Product-Architecture Framing

When a QA finding, user frustration, or implementation issue points to a broader
capability, define the slice from the product capability first.

A slice proposal should answer, in this order:

1. What product capability or user story does this establish?
2. What product decision does it settle?
3. For a cross-cutting foundation, what is the compact
   `Future Workflow Boundary`?
4. What dependencies, state boundaries, storage layers, contracts, services, and
   tests are needed to make the capability dependable?
5. Which slice-specific negative side effects require protection beyond the
   shared product guardrails?
6. What acceptance criteria prove both the new capability and preserved behavior?

Use this table for a `Future Workflow Boundary`:

| Boundary               | Required content                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Current workflow       | The end-to-end user workflow this slice must make dependable.                                 |
| Predictable extensions | Near-term workflows that materially shape today's architecture.                               |
| Participating layers   | Product layers that own behavior in the current workflow.                                     |
| Near-term seams        | Interfaces required now so the predictable extensions do not need a replacement architecture. |
| Exclusions             | Deliberately excluded layers and the stable reason they can wait.                             |

Keep the table compact. It is a decision boundary, not a speculative catalog of
every feature Azurite may eventually gain. Omit it for isolated, reversible work
whose correct boundary is already obvious.

Do not frame foundational work as a narrow bug fix when the evidence shows that
Azurite needs a reusable architecture. Prefer durable product foundations over
patches that would require predictable replacement.

Avoid proposals that solve only the observed symptom while ignoring the product
capability revealed by that symptom.

## Regression And Side-Effect Guardrails

Every meaningful slice should define not only what new capability becomes true,
but also what existing guarantees must remain true.

A regression is when behavior, safety, performance, data integrity, recovery, or
user experience that already worked gets worse because of a new change. Other
negative side effects include silent data loss, stale state, hidden degraded
states, weaker validation, duplicated sources of truth, broken browser history,
performance cliffs, confusing UI copy, and tests that pass while real product
behavior fails.

Azurite's universal preservation guarantees live in
`docs/reference/product-guardrails.md`. Meaningful slice proposals must link to
that baseline instead of copying it.

Add a `Negative Side-Effect Guardrails` section when the slice introduces risks
that are specific to its changed behavior. Name only concrete failure modes the
shared baseline does not express precisely enough, such as a new migration
rollback, a new route transition, a new cache invalidation rule, or a new
external-service degraded state.

The implementation and verification plan should cover both the new behavior and
these preservation guarantees. Do not accept a slice as complete when it adds
the requested capability but silently breaks an earlier product promise.

## Implementation Plans

Implementation plans should be decisive, not speculative.

- Use definite language for chosen slice behavior, data shapes, route shapes,
  validation rules, and acceptance criteria.
- Do not write plan steps around "probably", "maybe", or vague optionality.
- If implementation reveals that a planned decision is wrong, correct the plan
  or record the decision change instead of quietly drifting.
- Keep open questions explicit and separate from committed implementation steps.
- Prefer reusing existing schemas, types, helpers, and domain functions before
  adding new ones.
- When a reused helper or schema needs to support an additional context, extend
  it intentionally and test every supported context rather than creating a
  parallel near-copy.
- Dependency decisions should be made from the intended product architecture.
  Compare categories honestly, such as state stores, routers, IndexedDB
  wrappers, databases, caches, and validation libraries, before selecting a
  tool.
- If a dependency is chosen, document the product role it owns and the kind of
  future work it should make easier.
- For cross-cutting foundations such as observability, persistence, routing,
  editor integration, authentication, search, indexing, sync, local hosting,
  storage, and telemetry, compare tools by the future product role they will
  own. Prefer adopting a durable platform or dependency when the capability
  needs correlation, inspection, replay, persistence, security, or operational
  workflow that would otherwise become custom infrastructure inside Azurite.

## Sentry Debug Mode

Sentry debug mode is intentionally uncensored. When a slice uses Sentry behind
explicit debug configuration, the correct default is complete capture, not
privacy minimization.

Do not add Sentry requirements that redact, mask, hash, sanitize, or omit
Azurite debugging data for privacy reasons. Do not challenge a Sentry slice
because it captures real note content, editor replay, local paths, app state,
request payloads, draft data, or backend error context.

Sentry acceptance criteria should prove that the captured data is rich enough to
debug real failures across the browser, editor, client state, IndexedDB, API
requests, Fastify handlers, and filesystem operations.

Keep Sentry-disabled behavior unchanged. Apply the credential-containment rules
in `docs/reference/product-guardrails.md` without censoring Azurite product data.

## Quality And Scope

High standards are welcome. Use them to complete the current user story with the
architecture and verification it needs.

If implementation reveals required work that belongs to the same user story,
include it in the slice. If work belongs in a separate slice, explain the stable
value boundary that makes the split healthy.

## Implementation Loop

Use this loop for meaningful product work:

1. Choose a coherent user story, product capability, refactor, foundation, or
   quality improvement.
2. Research only the domain needed for that delivery unit, deeply enough to
   preserve fidelity.
3. Record important sources, constraints, and decisions.
4. Link the shared product guardrails and define only slice-specific regression
   risks.
5. Implement the slice across every layer required to complete it honestly.
6. Verify both the new behavior and the preserved guardrail behavior with tests,
   manual checks, or a local demo.
7. Summarize what changed, what was preserved, and identify the next valuable
   delivery unit.
