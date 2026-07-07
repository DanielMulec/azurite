# Azurite Product Vision

## Summary

Azurite is intended to become a production-quality, locally hosted knowledge
application that combines Obsidian-style knowledge infrastructure with a
Notion-style web experience.

The system should feel polished and dependable enough for daily use, while
keeping the user's knowledge base transparent, portable, and markdown-first.

## Core Direction

- Build a hybrid of Obsidian and Notion, not a clone of either product.
- Treat markdown files as the source of truth for all knowledge content.
- Keep the early content model limited to structures that are supported by
  markdown and can round-trip cleanly back to markdown files.
- Keep knowledge behavior local-first, inspectable, and resilient.
- Prefer durable architecture over quick prototypes when making foundation-level
  decisions.

## Knowledge Backend

The backend should follow the spirit of Obsidian's knowledge model and
programmatic capabilities:

- Markdown-native storage for notes and knowledge artifacts.
- Fast indexing of documents, links, tags, metadata, headings, and references.
- Graph-aware behavior for links, backlinks, unresolved links, and relationship
  exploration.
- Workspace-level organization similar to Obsidian vaults, but do not call the
  concept "vaults".
- LSP-like knowledge services where useful, such as link resolution, reference
  lookup, rename support, diagnostics for broken links, document symbols,
  completions, and hover metadata.
- Derived indexes and caches may exist, but they must be rebuildable from the
  markdown source.

For now, use "workspace" as the neutral term for a self-contained collection of
markdown knowledge, configuration, indexes, and graph state. The final product
name for this concept can still change. Possible alternatives include
"chamber", "library", or "collection".

## Repository And Workspace Boundaries

Keep these locations conceptually separate:

- Source repository: this Git repository is for Azurite's application source
  code, documentation, tests, and development tooling.
- Installed or running product: the built Azurite app, server, runtime, and
  supporting files should be installable or runnable from any appropriate folder
  on the user's system. The product must not depend on this Git checkout being
  its runtime location.
- Knowledge workspace: the user's markdown knowledge collection must be usable
  from anywhere on the system, such as an existing notes folder, a synced
  directory, an external drive, or another local path selected by the user.

User knowledge workspaces must not be coupled to this repository or stored
inside it by default. The application should treat workspace locations as
user-selected filesystem roots. Any generated indexes, caches, or app metadata
must respect that boundary: source markdown remains in the chosen workspace, and
derived state should be clearly separated, rebuildable, and safe to delete.

## Frontend

The frontend should be web-based and usable as a progressive web app on both
desktop and smartphone.

- The primary interface should be a local web app.
- It should support installation or app-like use as a PWA.
- The mobile experience matters because the app will be used from a smartphone.
- The desktop experience should feel efficient for deep writing, navigation,
  linking, and knowledge work.
- The visual and interaction quality should aim for a Notion-level sense of
  polish, clarity, and approachability without adopting Notion-only content
  blocks that cannot be represented in markdown.

## Markdown Rendering Scope

The Notion-inspired part of the product is about frontend polish, interaction
quality, and approachable editing, not about adopting a proprietary block model.

In the early stages, the frontend should only render and edit content structures
that are officially supported by markdown or by the project's explicitly chosen
markdown dialect. Every visible content block should have a faithful markdown
representation because all knowledge files are markdown files.

Do not add Notion-style proprietary blocks that cannot be represented in
markdown. A parser/renderer system for non-standard blocks may be considered
later, but it should be treated as a deliberate extension rather than part of
the initial product scope.

## Local Access And Security

Azurite is intended to be hosted locally and accessed privately.

- No one outside the user's Tailscale network should have access.
- Smartphone access should happen over Tailscale.
- Desktop access should also work as a local or Tailscale-reachable PWA.
- Public internet exposure is out of scope unless explicitly reconsidered later.
- Deployment decisions should preserve the private-by-default access model.

## Quality Bar

Production quality means:

- Reliable persistence and recoverability of markdown content.
- Clear separation between source content and rebuildable derived state.
- Strong tests around indexing, linking, graph behavior, and synchronization
  boundaries.
- Thoughtful handling of malformed markdown, missing files, renamed documents,
  and broken links.
- A responsive, accessible, and robust PWA user experience across desktop and
  mobile.
- Security decisions that assume private knowledge content is sensitive.

## Open Product Decisions

- Final name for the workspace-like container concept.
- Exact markdown extensions and frontmatter conventions.
- Whether editing should be pure markdown, block-oriented, or a careful hybrid.
- How much Notion-like structured data should exist while keeping markdown as
  the source of truth.
- Whether a later parser/renderer layer should support deliberate non-standard
  markdown extensions or custom blocks.
- Authentication and network-binding strategy for local plus Tailscale access.
