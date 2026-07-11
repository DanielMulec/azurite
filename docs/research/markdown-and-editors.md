# Markdown And Editors Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

Azurite uses Milkdown with Crepe as its chosen WYSIWYG Markdown editor. These
sources support its implementation, upgrades, and Markdown-fidelity work;
unselected editor candidates are intentionally not retained here.

### Milkdown

- URL: https://milkdown.dev/
- Accessed: 2026-07-07
- Area: Chosen WYSIWYG Markdown editor
- Use when: Reviewing Milkdown capabilities, compatibility, or upgrade notes for
  Azurite's existing editor architecture.
- Notes: Milkdown is a plugin-driven WYSIWYG Markdown editor framework.
- Caveats: Verify fidelity, malformed-Markdown behavior, and lifecycle behavior
  with Azurite's regression suite whenever the editor changes.

### Milkdown GitHub

- URL: https://github.com/Milkdown/milkdown
- Accessed: 2026-07-07
- Area: Editor architecture, releases, and license
- Use when: Reviewing Milkdown's release status, license, source, or architecture
  before an Azurite upgrade.
- Notes: Milkdown describes itself as a plugin-driven WYSIWYG Markdown editor
  built on ProseMirror and remark.
- Caveats: Azurite owns its React lifecycle, Markdown authority, drafts, and
  transition behavior; project examples do not define those contracts.

### Milkdown Crepe

- URL: https://milkdown.dev/docs/guide/using-crepe
- Accessed: 2026-07-07
- Area: Full-featured Milkdown editor UI
- Use when: Configuring or extending Azurite's Crepe editor surface.
- Notes: Crepe is Milkdown's feature-rich editor builder and exposes read-only
  and Markdown access APIs.
- Caveats: Verify dynamic documentation and pinned runtime behavior before
  relying on an API during an upgrade.

### Milkdown Crepe API

- URL: https://milkdown.dev/docs/api/crepe
- Accessed: 2026-07-07
- Area: Crepe configuration and feature behavior
- Use when: Implementing or configuring the Crepe editor surface.
- Notes: Documents Crepe configuration, editor features, and built-in behavior
  such as image upload handling when image features are enabled.
- Caveats: Keep the integration local-only; do not enable upload or remote
  behavior without a focused product slice.

### Milkdown React Recipe

- URL: https://milkdown.dev/docs/recipes/react
- Accessed: 2026-07-07
- Area: React integration for Milkdown and Crepe
- Use when: Mounting Milkdown or Crepe inside the React web app.
- Notes: Milkdown provides React support and documents Crepe as its
  feature-rich WYSIWYG editor path.
- Caveats: Verify lifecycle cleanup in Azurite tests and browser smoke checks.

### Milkdown Examples

- URL: https://github.com/Milkdown/examples
- Accessed: 2026-07-07
- Area: Practical Milkdown and Crepe integration examples
- Use when: Checking concrete React Crepe usage and feature-selection patterns.
- Notes: Includes React Crepe and Crepe Builder examples.
- Caveats: Examples are implementation references, not Azurite architecture;
  adapt them to local component boundaries and tests.

### Milkdown React Crepe Example

- URL: https://github.com/Milkdown/examples/blob/main/react-crepe/components/Editor.tsx
- Accessed: 2026-07-11
- Area: React and Crepe lifecycle ownership
- Use when: Deciding whether ordinary React rerenders should reconstruct a Crepe
  instance.
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
