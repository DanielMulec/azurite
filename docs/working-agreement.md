# Working Agreement

## High-Fidelity Tiny Increments

Azurite should be built in small, high-quality increments. The goal is not to
move fast by lowering fidelity. The goal is to keep each task small enough that
it can be researched, implemented, reviewed, and verified properly.

When a feature touches behavior inspired by Obsidian, Notion, markdown tools,
LSPs, PWAs, or security-sensitive local hosting, fidelity matters. Research
should be deep enough for the selected slice to be excellent, not merely
plausible.

## Research Scope

Research should be scoped, not rushed.

- Do not time-box research in a way that risks shallow or inaccurate behavior.
- Do not expand one feature into a broad research phase for the entire product.
- Research the smallest useful behavior deeply enough to make a strong
  implementation decision.
- Convert research into one or more concrete outputs: code, tests, a short
  decision note, a source entry, or a clearly documented follow-up.
- Track reusable sources in `docs/research-sources.md`, while still looking for
  additional current sources when research matters.

## Slice Selection

Prefer slices that produce visible or testable product progress.

Good slices are narrow and concrete, for example:

- Detect and index one markdown link format correctly.
- Render one supported markdown structure in the frontend.
- Save one edited markdown note without losing formatting.
- Show backlinks for one note from a rebuildable index.
- Bind the local server in a way that supports private Tailscale access.

Avoid slices that quietly turn into broad platform research before a working
behavior exists.

## Quality And Perfectionism

High standards are welcome. Use them to make the current slice excellent rather
than to continually widen the slice.

Before expanding scope, ask whether the current behavior can be made complete,
tested, and useful first. If the answer is yes, finish the slice and record the
next improvement separately.

## Implementation Loop

Use this loop for meaningful product work:

1. Choose a small behavior or outcome.
2. Research only the domain needed for that behavior, deeply enough to preserve
   fidelity.
3. Record important sources, constraints, and decisions.
4. Implement the slice.
5. Verify it with tests, manual checks, or a local demo.
6. Summarize what changed and identify the next narrow slice.
