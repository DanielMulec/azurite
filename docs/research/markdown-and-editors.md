# Markdown And Editors Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

### CodeMirror Markdown Language Support

- URL: https://github.com/codemirror/lang-markdown
- Accessed: 2026-07-07
- Area: Markdown editing
- Use when: Evaluating a raw markdown editor fallback or complementary source
  editing mode.
- Notes: Provides Markdown language support for CodeMirror.
- Caveats: Less suited to read-only rendered Notion-like viewing than richer
  editor candidates; a comfort layer still needs product-specific UI work.

### CodeMirror Read-Only Editor

- URL: https://codemirror.net/examples/readonly/
- Accessed: 2026-07-07
- Area: Source-mode and read-only markdown editing
- Use when: Evaluating CodeMirror as a raw markdown source editor, source-mode
  fallback, code block editor, or read-only source view.
- Notes: CodeMirror separates editor state read-only behavior from DOM
  editability.
- Caveats: Read-only source editing is not the same as a rendered Notion-like
  note view.

### ProseMirror Markdown Example

- URL: https://prosemirror.net/examples/markdown/
- Accessed: 2026-07-07
- Area: Rich markdown editing research
- Use when: Evaluating richer WYSIWYG markdown editing.
- Notes: The markdown package defines a schema for what Markdown can express and
  includes parser/serializer behavior.
- Caveats: Must be tested for round-trip fidelity against Azurite's chosen
  markdown dialect.

### ProseMirror Markdown Integration

- URL: https://github.com/ProseMirror/prosemirror-markdown
- Accessed: 2026-07-07
- Area: Low-level rich markdown editing
- Use when: Evaluating a direct ProseMirror fallback or understanding the
  markdown parser/serializer foundation used by richer editor stacks.
- Notes: Provides a CommonMark-shaped schema plus parser and serializer between
  ProseMirror documents and Markdown text.
- Caveats: Direct ProseMirror gives control but requires building more editor
  product behavior ourselves.

### Milkdown

- URL: https://milkdown.dev/
- Accessed: 2026-07-07
- Area: Rich markdown editing research
- Use when: Evaluating WYSIWYG markdown editor options.
- Notes: Milkdown is a plugin-driven WYSIWYG markdown editor framework.
- Caveats: Do not adopt without a focused fidelity and complexity test.

### Milkdown GitHub

- URL: https://github.com/Milkdown/milkdown
- Accessed: 2026-07-07
- Area: WYSIWYG markdown editor framework
- Use when: Evaluating Milkdown's project status, license, and architecture.
- Notes: Milkdown describes itself as a plugin-driven WYSIWYG markdown editor
  built on ProseMirror and remark.
- Caveats: React lifecycle ergonomics, malformed markdown behavior, and
  read-only viewer suitability need hands-on verification.

### Milkdown Crepe

- URL: https://milkdown.dev/docs/guide/using-crepe
- Accessed: 2026-07-07
- Area: Full-featured Milkdown editor UI
- Use when: Evaluating whether Milkdown can provide a complete enough editing
  surface for Azurite without building every editor control from scratch.
- Notes: Crepe is Milkdown's richer editor builder and exposes read-only and
  markdown access APIs.
- Caveats: The docs are dynamic, so verify APIs directly in a prototype before
  relying on them.

### Milkdown Crepe API

- URL: https://milkdown.dev/docs/api/crepe
- Accessed: 2026-07-07
- Area: Crepe editor configuration and feature behavior
- Use when: Implementing or configuring the Crepe editor surface.
- Notes: Documents Crepe configuration, editor features, and built-in behavior
  such as image upload handling when image features are enabled.
- Caveats: Keep the first Azurite integration local-only and avoid enabling
  upload or remote behavior opportunistically.

### Milkdown React Recipe

- URL: https://milkdown.dev/docs/recipes/react
- Accessed: 2026-07-07
- Area: React integration for Milkdown and Crepe
- Use when: Mounting Milkdown or Crepe inside the React web app.
- Notes: Milkdown provides first-class React support and documents using Crepe
  as the feature-rich WYSIWYG editor path.
- Caveats: Verify lifecycle cleanup in Azurite tests and browser smoke checks.

### Milkdown Examples

- URL: https://github.com/Milkdown/examples
- Accessed: 2026-07-07
- Area: Practical Milkdown and Crepe integration examples
- Use when: Checking concrete React Crepe usage and feature selection patterns.
- Notes: Includes a React Crepe example and a Crepe Builder example for
  selecting editor features.
- Caveats: Examples are implementation references, not Azurite architecture;
  adapt them to local component boundaries and tests.

### Milkdown React Crepe Example

- URL: https://github.com/Milkdown/examples/blob/main/react-crepe/components/Editor.tsx
- Accessed: 2026-07-11
- Area: React and Crepe lifecycle ownership
- Use when: Deciding whether ordinary React rerenders should reconstruct a
  Crepe instance.
- Notes: The official example creates Crepe through a stable `useEditor`
  factory with an empty dependency list, matching one editor instance per
  mounted editing lifetime.
- Caveats: The example is intentionally minimal. Azurite still owns session
  identity, source-mode synchronization, drafts, transition commits, and stale
  asynchronous-work tests.

### Milkdown 7.21.2 Crepe Builder Source

- URL: https://github.com/Milkdown/milkdown/blob/v7.21.2/packages/crepe/src/core/builder.ts
- Accessed: 2026-07-11
- Area: Crepe creation, destruction, and public runtime APIs
- Use when: Implementing a session-owned Crepe lifecycle or reading current
  Markdown before an Azurite transition.
- Notes: The pinned builder consumes `defaultValue` during construction,
  exposes explicit `create()` and `destroy()` lifecycle methods, and provides
  public `getMarkdown()`, listener registration, and underlying editor action
  access.
- Caveats: Runtime methods require the relevant Milkdown contexts to be ready.
  Recheck the pinned source and browser regression suite after an editor upgrade.

### Milkdown 7.21.2 Listener Plugin Source

- URL: https://github.com/Milkdown/milkdown/blob/v7.21.2/packages/plugins/plugin-listener/src/index.ts
- Accessed: 2026-07-11
- Area: Editor lifecycle and Markdown change authority
- Use when: Deciding whether a Milkdown Markdown callback proves user intent or
  is only evidence that the editor document changed.
- Notes: The installed listener initializes previous document and Markdown
  state, debounces eligible document changes for 200 milliseconds, and exposes
  current and previous Markdown without the originating transaction.
- Caveats: This describes the pinned 7.21.2 implementation. Recheck the source
  and Azurite regression suite before relying on the same lifecycle after a
  Milkdown upgrade.

### Milkdown 7.21.2 `replaceAll` Source

- URL: https://github.com/Milkdown/milkdown/blob/v7.21.2/packages/utils/src/macro/replace-all.ts
- Accessed: 2026-07-11
- Area: Source-to-WYSIWYG synchronization
- Use when: Distinguishing a programmatic Markdown replacement from a user edit.
- Notes: With `flush` enabled, `replaceAll` parses Markdown, creates a fresh
  editor state, and passes it to the view through `updateState`.
- Caveats: State replacement can reinitialize plugin-local state. Azurite must
  verify its projection baseline and listener behavior whenever this API or the
  editor integration changes.

### Tiptap Markdown

- URL: https://tiptap.dev/docs/editor/markdown
- Accessed: 2026-07-07
- Area: Rich markdown editing research
- Use when: Evaluating Tiptap for bidirectional markdown editing.
- Notes: Tiptap documents markdown parsing and serialization support.
- Caveats: The documented markdown feature is marked beta, so it needs careful
  validation before depending on it.

### Tiptap Static Renderer

- URL: https://tiptap.dev/docs/editor/api/utilities/static-renderer
- Accessed: 2026-07-07
- Area: Read-only rendering and format conversion
- Use when: Evaluating whether Tiptap can replace or complement Azurite's
  Slice 3 read-only renderer.
- Notes: Renders Tiptap/ProseMirror JSON to HTML, Markdown, or React components
  without an editor instance.
- Caveats: Works from Tiptap JSON, so Azurite must still prove markdown can
  remain canonical.

### Tiptap Editor API

- URL: https://tiptap.dev/docs/editor/api/editor
- Accessed: 2026-07-07
- Area: Editor configuration and read-only mode
- Use when: Evaluating Tiptap as an editable and read-only rich editor.
- Notes: The `editable` option controls whether users can write into the
  editor.
- Caveats: Read-only editor mode does not by itself prove markdown round-trip
  fidelity.

### Tiptap Open Source And Platform Features

- URL: https://tiptap.dev/feature-comparison
- Accessed: 2026-07-07
- Area: Rich editor licensing and paid feature boundaries
- Use when: Checking whether a Tiptap-based editor direction stays inside free
  open-source dependencies.
- Notes: Tiptap documents the core editor as open source under the MIT license,
  while platform features and cloud documents are priced separately.
- Caveats: Free core editor availability does not include every polished UI
  template or advanced hosted feature.

### Tiptap Notion-Like Template

- URL: https://tiptap.dev/docs/ui-components/templates/notion-like-editor
- Accessed: 2026-07-07
- Area: Rich editor UI template and paid plan boundary
- Use when: Comparing Tiptap's polished Notion-like experience with Azurite's
  no-paid-editor-package constraint.
- Notes: The Notion-like template requires at least a Start plan subscription
  for production use.
- Caveats: Do not treat the paid template demo as evidence that Azurite can get
  that UX from Tiptap's free core editor without building substantial UI.

### MDXEditor

- URL: https://mdxeditor.dev/
- Accessed: 2026-07-07
- Area: React rich markdown editor
- Use when: Evaluating markdown-persistent, Notion-like editing for React.
- Notes: MDXEditor presents itself as an open-source React component for editing
  markdown documents naturally, with configurable markdown output and features
  such as tables, frontmatter, source/diff view, and code block editing.
- Caveats: It recommends rendering markdown separately for read-only display, so
  it may complement rather than replace Azurite's renderer.

### MDXEditor Architecture Overview

- URL: https://mdxeditor.dev/editor/docs/overview
- Accessed: 2026-07-07
- Area: Markdown editor architecture
- Use when: Understanding how MDXEditor converts between markdown and its
  internal editor representation.
- Notes: MDXEditor uses MDAST-to-Lexical conversion visitors and treats
  markdown as a suitable persistent format.
- Caveats: Constrain MDX-specific features until Azurite deliberately expands
  beyond CommonMark plus GFM.

### Lexical Markdown

- URL: https://lexical.dev/docs/packages/lexical-markdown
- Accessed: 2026-07-07
- Area: Rich editor markdown helpers
- Use when: Evaluating Lexical directly or understanding MDXEditor's underlying
  editor framework.
- Notes: Provides Markdown import, export, shortcuts, and transformer APIs.
- Caveats: Direct Lexical would require Azurite to build much of the markdown
  editor layer itself.

### Lexical Read Mode

- URL: https://lexical.dev/docs/concepts/read-only
- Accessed: 2026-07-07
- Area: Rich editor read-only mode
- Use when: Evaluating direct Lexical rendering or read-only editor behavior.
- Notes: Lexical supports read and edit modes through editor editability.
- Caveats: Read mode does not solve markdown canonicality by itself.

### BlockNote Format Interoperability

- URL: https://www.blocknotejs.org/docs/foundations/supported-formats
- Accessed: 2026-07-07
- Area: Block editor storage formats
- Use when: Evaluating Notion-like block editors against Azurite's
  markdown-canonical rule.
- Notes: BlockNote documents Markdown import/export as lossy and recommends its
  native JSON document for lossless storage.
- Caveats: This conflicts with Azurite's current source-of-truth requirement.

### BlockNote Markdown Import

- URL: https://www.blocknotejs.org/docs/features/import/markdown
- Accessed: 2026-07-07
- Area: Markdown import for block editors
- Use when: Checking whether BlockNote can safely ingest existing markdown
  notes.
- Notes: Supports a common Markdown/GFM subset but documents import as lossy.
- Caveats: Lossy import is unacceptable for Azurite's primary editor path.

### BlockNote Markdown Export

- URL: https://www.blocknotejs.org/docs/features/export/markdown
- Accessed: 2026-07-07
- Area: Markdown export for block editors
- Use when: Checking whether BlockNote can preserve markdown as canonical
  storage.
- Notes: Markdown export is documented as lossy.
- Caveats: This makes BlockNote a poor primary fit despite its strong
  Notion-like UX.

### Plate Markdown

- URL: https://platejs.org/docs/markdown
- Accessed: 2026-07-07
- Area: Rich markdown editing and Slate/Plate conversion
- Use when: Evaluating a Slate-based rich editor path with markdown
  import/export.
- Notes: Plate documents two-way Markdown conversion, CommonMark/GFM support,
  customizable rules, and remark plugin integration.
- Caveats: Broad ecosystem decision; keep as a fallback if simpler
  markdown-first candidates fail.

### Remirror Markdown Editor

- URL: https://www.remirror.io/docs/showcase/markdown/
- Accessed: 2026-07-07
- Area: ProseMirror-based markdown editor
- Use when: Evaluating Remirror's markdown editor as an alternative rich
  editing wrapper.
- Notes: Remirror provides a Markdown editor and examples that expose markdown
  through helpers.
- Caveats: Current package activity is quieter than Tiptap, Milkdown, and
  MDXEditor.

### Remirror Markdown Extension

- URL: https://www.remirror.io/docs/extensions/markdown-extension/
- Accessed: 2026-07-07
- Area: ProseMirror-to-markdown conversion
- Use when: Evaluating markdown persistence in Remirror.
- Notes: The extension converts ProseMirror content to Markdown and Markdown
  into a ProseMirror document.
- Caveats: Treat as a secondary candidate unless leading prototypes fail.

### CKEditor Markdown Output

- URL: https://ckeditor.com/docs/ckeditor5/latest/features/markdown.html
- Accessed: 2026-07-07
- Area: Commercial-grade rich editor markdown output
- Use when: Comparing mature WYSIWYG editor behavior and markdown output
  limitations.
- Notes: CKEditor can output GFM Markdown and supports essential Markdown
  structures.
- Caveats: Docs warn Markdown cannot represent all rich-text features and
  licensing/premium feature boundaries add friction.

### CKEditor Read-Only Support

- URL: https://ckeditor.com/docs/ckeditor5/latest/features/read-only.html
- Accessed: 2026-07-07
- Area: Rich editor read-only behavior
- Use when: Comparing mature read-only editor modes.
- Notes: CKEditor has first-class read-only mode and toolbar hiding guidance.
- Caveats: Mature read-only behavior does not override markdown-source and
  licensing concerns.

### Toast UI Editor

- URL: https://ui.toast.com/tui-editor/
- Accessed: 2026-07-07
- Area: Markdown and WYSIWYG editor
- Use when: Comparing older all-in-one markdown editor/viewer options.
- Notes: Provides Markdown mode, WYSIWYG mode, GFM/CommonMark positioning, and a
  viewer mode.
- Caveats: The React wrapper repository is deprecated and package activity is
  much older than leading candidates.

### EasyMDE

- URL: https://github.com/ionaru/easy-markdown-editor
- Accessed: 2026-07-07
- Area: Source markdown editor
- Use when: Comparing source/preview markdown editors.
- Notes: A textarea-based markdown editor with toolbar, preview, and TypeScript
  support.
- Caveats: Not a Notion-like rendered editor and not a solution for the
  read-only rendered-view concern.

### Editor.js

- URL: https://editorjs.io/
- Accessed: 2026-07-07
- Area: Block-style editor architecture
- Use when: Checking block editor candidates against Azurite's markdown-first
  product rule.
- Notes: Editor.js is a block-style editor with universal JSON output.
- Caveats: JSON-first output conflicts with canonical markdown files.

### Editor.js Base Concepts

- URL: https://editorjs.io/base-concepts/
- Accessed: 2026-07-07
- Area: Block editor storage model
- Use when: Understanding Editor.js output and plugin model.
- Notes: Editor.js outputs clean JSON rather than HTML.
- Caveats: Markdown import/export would require extra conversion outside the
  core editor model.

### Slate

- URL: https://docs.slatejs.org/
- Accessed: 2026-07-07
- Area: Rich editor framework
- Use when: Evaluating lower-level editor frameworks.
- Notes: Slate is customizable and React-oriented, with a nested document model.
- Caveats: Markdown serialization is not a turnkey primary feature; Plate is the
  better Slate-path candidate for Azurite.
