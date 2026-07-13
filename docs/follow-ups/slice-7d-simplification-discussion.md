# Slice 7D Simplification Discussion

This document preserves a side conversation from July 13–14, 2026 for Daniel
to revisit with GPT after Slice 7D is fully implemented and verified. It is
discussion material, not an authoritative product contract, architecture
decision, implementation plan, or new slice. Its purpose is to retain the
questions and uncomfortable evidence that should inform the next decision.

The related shared-backlog item is `AZ-018`, _Reassess and simplify Azurite
architecture after Slice 7D_. That item remains blocked until Slice 7D is
complete.

## Why The Conversation Started

During implementation, Daniel noticed that Slice 7D had already produced a net
increase of approximately 4,776 lines while substantial work remained. A
read-only comparison against the implementation baseline found approximately
4,771 net lines at that point:

- production code: about 3,734 net lines;
- tests: about 973 net lines;
- documentation and other files: about 64 net lines.

The important result was that tests and documentation did not explain the
growth. Roughly 78 percent was production code. Three orchestration modules
alone were close to the project's 400-line file limit: the Markdown-authority
controller, draft-persistence coordinator, and editor-session gate. Additional
growth came from durability, recovery, cleanup, settlement, and save-rebase
actions, plus workflow/result/type contracts and their mapping or construction
layers.

Later in the implementation, Daniel observed that the slice had grown to
roughly 7,09x net lines and was still unfinished. That strengthened the concern:
this was no longer ordinary implementation growth but evidence that the slice's
conceptual model had expanded into a substantial architecture of its own.

## The Architectural Concern

Some of Slice 7D's complexity is real and valuable. Exact Markdown authority,
edit-during-save behavior, ordered browser-draft writes, future-schema
protection, recovery, route handoff, and prevention of stale editor callbacks
all protect user work. Simplification must not erase those product truths.

The concern is that the implementation may have translated the specification
too literally into separate software concepts. The discussion identified these
possible symptoms:

- separate discriminated result families at many boundaries;
- result builders and mapping layers that mirror those result types;
- several action modules governing closely related lifecycle states;
- orchestration modules approaching the file-size limit before the slice is
  complete;
- overlapping state machines across React, Zustand, the Markdown-authority
  controller, the editor-session gate, and persistence;
- proof infrastructure becoming a subsystem rather than remaining a narrow
  testing aid.

The hard 400-line limit explains why the implementation occupies many files,
but it does not explain the net growth. The net growth comes from introducing
and connecting many distinct protocols.

The desired future direction is not shallower engineering. A smaller codebase
may need a few deeper, carefully chosen primitives. Concentrating complexity in
one authoritative state machine, command boundary, or persistence abstraction
could remove distributed defensive ceremony while retaining stronger behavior.

## The Standalone Harness Example

The Markdown-fidelity lifecycle harness became a concrete example of how scope
can silently authorize itself.

The harness is a separate QA-only Vite application. It mounts the production
`MilkdownEditor` while replacing the Crepe factory with a controlled runtime.
Browser QA can hold editor creation pending, resolve it, or reject it. A
separate build and an output scanner prove that the harness entry, marker, and
fault controls do not appear in the ordinary Azurite product bundle.

The underlying QA need is legitimate: pending and rejected editor creation are
difficult to reproduce deterministically in the normal application, and
product-visible fault switches would be undesirable. The standalone
application is technically defensible as one possible proof mechanism.

Daniel did not, however, explicitly request or approve that mechanism. Git
history shows that Codex introduced the harness requirement into the planned
slice in commit `5d51b92` on July 12, 2026. Codex later added the dedicated
commands and ordinary-bundle exclusion assertion in commit `413363e` on July
13. The commits use Daniel's configured Git identity, but the first is described
as an automated Codex hook synchronization; the Git author therefore does not
establish that Daniel authored or deliberately selected the requirement.

The subsequent implementation goal required everything in the checked-in Slice
7D document to be implemented. A later Codex consequently treated the earlier
Codex-authored QA mechanism as binding scope.

The distinction to preserve is:

- the product truth is that exact editable Markdown remains safe while rich
  editor creation is pending or fails;
- deterministic browser evidence is required to support that truth;
- a standalone Vite lifecycle application is one proposed evidence mechanism,
  not inherently part of the product requirement.

This creates a scope-governance question for future work: a slice document
should not allow Codex to propose substantial infrastructure and then treat its
own proposal as if Daniel had mandated it. New standalone applications,
dependencies, storage boundaries, build systems, or similarly material proof
mechanisms should be surfaced as decisions before they become binding
implementation scope.

## Timing Of The Simplification

Daniel was understandably reluctant to restructure the system while Slice 7D
was still implementing. An incomplete persistence and lifecycle transition is a
poor refactoring baseline because failures cannot be attributed confidently to
unfinished behavior or architectural change.

The conversation therefore favored finishing and verifying Slice 7D first. Its
acceptance tests and browser evidence can then become the behavioral safety net
for simplification. The product truths deserve preservation; the implementation
shape does not deserve preservation merely because it was expensive to create.

The conversation did not favor automatically implementing 7E and a possible 7F
before reassessment. If those slices build on 7D's current result vocabulary,
state ownership, and orchestration boundaries, they may pour concrete around
the very shape that needs examination. There was also confusion about 7F:
Daniel had seen it referenced although no authoritative 7F document appeared to
exist. Its actual status and dependency relationship should be established
before treating it as scheduled work.

## Questions To Discuss With GPT After 7D

The follow-up should begin from the completed behavior and evidence rather than
from a predetermined rewrite:

1. Which user-visible and data-integrity guarantees did Slice 7D establish, and
   which tests prove each guarantee?
2. How many independent state owners and state machines now participate in one
   editor session? Which are essential, and which express the same lifecycle in
   different vocabularies?
3. Which discriminated result families change a caller's behavior? Which exist
   mainly to transport diagnostic detail or satisfy a locally explicit type?
4. Where do builders, mappers, and action layers repeat information without
   creating a meaningful ownership boundary?
5. Can editor authority, route handoff, and persistence ordering each have one
   unmistakable owner with narrower adapters around them?
6. Can shared primitives become deeper while the total number of concepts,
   transitions, and production lines becomes smaller?
7. Which QA harnesses remain uniquely valuable? Which scenarios can use unit
   tests, component tests, the ordinary application, or one reusable fault
   laboratory instead of receiving a separate application and build?
8. How should React StrictMode compatibility constrain the new lifecycle model?
   Review the direction discussed in Codex thread
   `019f5068-ec86-7b31-a8d0-2f2fd821fc23`.
9. What is actually planned for 7E and 7F, and which parts should wait until the
   architectural reassessment is complete?
10. What explicit decision rule will prevent future Codex-authored proof
    mechanisms from becoming self-authorizing scope?

The outcome should be a deliberate architectural recommendation with measurable
simplification goals: fewer competing owners, fewer result vocabularies, fewer
transitions, less production code, clearer failure behavior, StrictMode-safe
lifecycle ownership, and no regression in Markdown fidelity, saving, recovery,
routing, security, or user-data integrity.
