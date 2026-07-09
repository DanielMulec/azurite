# Knowledge And Indexing Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

### remark

- URL: https://github.com/remarkjs/remark
- Accessed: 2026-07-07
- Area: Markdown parsing and transformation
- Use when: Building markdown parsing, rendering, and future link or heading
  extraction behavior.
- Notes: remark is a plugin-based markdown processor that can inspect and change
  markdown through syntax trees.
- Caveats: It is a foundation, not a complete Obsidian-like knowledge engine.

### micromark

- URL: https://github.com/micromark/micromark
- Accessed: 2026-07-07
- Area: Markdown parsing internals
- Use when: Evaluating low-level markdown parsing, custom syntax, or positional
  token behavior.
- Notes: micromark is a CommonMark-compliant parser that tracks concrete tokens
  and positional information.
- Caveats: Prefer remark-level APIs first unless a lower-level extension is
  truly needed.

### remark-wiki-link

- URL: https://github.com/flowershow/remark-wiki-link
- Accessed: 2026-07-07
- Area: Wiki-style and Obsidian-style link parsing
- Use when: Researching support for `[[wikilinks]]` and embedded wiki links.
- Notes: Provides a remark plugin for wiki-style links, including Obsidian-style
  links.
- Caveats: Must be tested against Azurite's exact desired wiki-link behavior
  before adoption.

### mdast-util-wiki-link

- URL: https://github.com/landakram/mdast-util-wiki-link/
- Accessed: 2026-07-07
- Area: Wiki-link AST utilities
- Use when: Evaluating lower-level AST support for parsing and serializing
  wiki-style links.
- Notes: Supports wiki links, existing/new link handling, and aliased wiki-link
  syntax.
- Caveats: Syntax details may not exactly match Obsidian; verify before using.

### remark-frontmatter

- URL: https://github.com/remarkjs/remark-frontmatter
- Accessed: 2026-07-07
- Area: Markdown metadata
- Use when: Adding frontmatter awareness to the markdown pipeline.
- Notes: Adds support for YAML, TOML, and other frontmatter nodes in remark.
- Caveats: Frontmatter is metadata, not rendered content; extraction and
  validation may need separate handling.

### mdast-util-to-string

- URL: https://github.com/syntax-tree/mdast-util-to-string
- Accessed: 2026-07-07
- Area: Heading and title extraction
- Use when: Extracting plain text from markdown AST nodes such as headings.
- Notes: Useful for turning a heading node into its readable text.
- Caveats: Does not serialize markdown; it only extracts textual content.

### Chokidar

- URL: https://github.com/paulmillr/chokidar
- Accessed: 2026-07-07
- Area: Filesystem watching
- Use when: Adding live workspace updates after the first discovery slice.
- Notes: Normalizes file watching behavior on top of Node's filesystem watcher
  APIs.
- Caveats: File watching has platform edge cases; add focused tests and manual
  checks before relying on it for indexes.

### MiniSearch

- URL: https://github.com/lucaong/minisearch
- Accessed: 2026-07-07
- Area: Full-text search
- Use when: Evaluating lightweight note search for small-to-medium local
  workspaces.
- Notes: In-memory JavaScript full-text search engine that can run in Node or
  the browser.
- Caveats: Search helper only; do not let it own the workspace index or source
  content. May not be enough for very large workspaces or persistent indexing.

### Fuse.js

- URL: https://www.fusejs.io/
- Accessed: 2026-07-07
- Area: Fuzzy search
- Use when: Evaluating quick fuzzy title/path search for note switching or
  lightweight filtering.
- Notes: Lightweight JavaScript fuzzy-search library with no dependencies.
- Caveats: Better suited to small-to-medium client-side datasets than durable
  full-workspace indexing.

### FlexSearch

- URL: https://github.com/nextapps-de/flexsearch
- Accessed: 2026-07-07
- Area: Full-text search
- Use when: Evaluating faster or more configurable JavaScript search indexing.
- Notes: Offers document search, partial matching, suggestions, and worker-based
  scaling options.
- Caveats: Search/index helper only; compare API complexity and persistence
  needs before choosing it.

### SQLite Appropriate Uses

- URL: https://sqlite.org/whentouse.html
- Accessed: 2026-07-07
- Area: Persistent local indexes
- Use when: Evaluating SQLite as a local derived index/cache for workspace
  metadata, search fields, links, backlinks, and recents.
- Notes: SQLite is commonly used as an on-disk application file format for local
  applications.
- Caveats: In Azurite, SQLite should be a rebuildable derived index, not the
  canonical note store.

### Node.js SQLite

- URL: https://nodejs.org/api/sqlite.html
- Accessed: 2026-07-07
- Area: Built-in SQLite runtime support
- Use when: Comparing built-in Node SQLite support with third-party SQLite
  packages for local indexes.
- Notes: Node.js documents `node:sqlite` with `DatabaseSync` for opening
  in-memory or file-backed databases.
- Caveats: Check current stability, sync API constraints, and packaging needs
  before adopting.

### better-sqlite3

- URL: https://github.com/WiseLibs/better-sqlite3
- Accessed: 2026-07-07
- Area: Persistent local indexes
- Use when: Evaluating SQLite-backed caches, indexes, or metadata storage.
- Notes: Node SQLite library focused on performance, transactions, and a simple
  synchronous API.
- Caveats: Native dependency and packaging behavior must be tested for the final
  install model. Compare against Node's built-in SQLite support before adding.

### Kuzu

- URL: https://github.com/kuzudb/kuzu
- Accessed: 2026-07-07
- Area: Graph storage research
- Use when: Evaluating whether Azurite needs an embedded graph database instead
  of a simpler derived graph index.
- Notes: Embedded property graph database with Node.js API support.
- Caveats: Likely too heavy for early slices; consider only after graph
  requirements are clearer.

### Foam

- URL: https://github.com/foambubble/foam
- Accessed: 2026-07-07
- Area: Reference knowledge app
- Use when: Researching open-source Markdown knowledge-base behavior, backlinks,
  wiki links, and graph views.
- Notes: Open-source VS Code-based personal knowledge management system.
- Caveats: Reference behavior and architecture only; do not copy broad product
  assumptions without focused evaluation.

### SilverBullet

- URL: https://github.com/silverbulletmd/silverbullet
- Accessed: 2026-07-07
- Area: Reference self-hosted Markdown knowledge app
- Use when: Researching browser-based, self-hosted, Markdown-backed knowledge
  app patterns.
- Notes: Open-source private browser-based personal knowledge database using
  Markdown files.
- Caveats: Reference behavior and architecture only; Azurite's product direction
  remains its own.
