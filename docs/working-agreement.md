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

A slice may span any product layer required to complete the user story honestly:
frontend UI, client state, URL state, browser storage, IndexedDB, backend
routes, shared contracts, filesystem behavior, databases, tests, documentation,
tooling, and development workflow.

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
3. What future workflows should this architecture support?
4. What dependencies, state boundaries, storage layers, contracts, and tests are
   needed to make the capability dependable?
5. What acceptance criteria prove the user story works?

Do not frame foundational work as a narrow bug fix when the evidence shows that
Azurite needs a reusable architecture. Prefer durable product foundations over
patches that would require predictable replacement.

Avoid proposals that solve only the observed symptom while ignoring the product
capability revealed by that symptom.

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
4. Implement the slice across every layer required to complete it honestly.
5. Verify it with tests, manual checks, or a local demo.
6. Summarize what changed and identify the next valuable delivery unit.
