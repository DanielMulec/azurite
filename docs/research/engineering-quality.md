# Engineering Quality Research Sources

These entries are part of Azurite's reusable research catalog. Usage rules and
the entry template live in `docs/research-sources.md`.

### TypeScript ESLint Configs

- URL: https://typescript-eslint.io/users/configs/
- Accessed: 2026-07-07
- Area: ESLint and TypeScript linting baseline
- Use when: Setting up or revisiting strict typed linting.
- Notes: Documents shared configs including strict type-checked options.
- Caveats: Typed linting has project setup and performance implications.

### Prettier

- URL: https://prettier.io/docs
- Accessed: 2026-07-07
- Area: Code formatting
- Use when: Setting up or revisiting automatic formatting.
- Notes: Prettier is an opinionated code formatter that reprints code into a
  consistent style.
- Caveats: Avoid ESLint stylistic rules that conflict with Prettier.

### TypeScript ESLint no-unsafe-assignment

- URL: https://typescript-eslint.io/rules/no-unsafe-assignment
- Accessed: 2026-07-07
- Area: Type safety
- Use when: Preventing `any` values from being assigned into typed variables or
  generic positions.
- Notes: Helps keep untyped data from silently spreading through the codebase.
- Caveats: JSON parsing and untyped third-party data should go through explicit
  validation instead of disable comments.

### TypeScript ESLint no-unsafe-argument

- URL: https://typescript-eslint.io/rules/no-unsafe-argument
- Accessed: 2026-07-07
- Area: Type safety
- Use when: Preventing `any` values from being passed into functions that expect
  specific types.
- Notes: Useful at API, validation, parser, and test boundaries.
- Caveats: Requires careful typing for helper utilities and test matchers.

### TypeScript ESLint no-floating-promises

- URL: https://typescript-eslint.io/rules/no-floating-promises/
- Accessed: 2026-07-07
- Area: Async safety
- Use when: Enforcing explicit promise handling.
- Notes: Reports promises that are not awaited, returned, caught, or explicitly
  ignored.
- Caveats: Intentional fire-and-forget work should be rare and clearly marked.

### TypeScript ESLint no-misused-promises

- URL: https://typescript-eslint.io/rules/no-misused-promises/
- Accessed: 2026-07-07
- Area: Async safety
- Use when: Preventing promises from being used in logical locations where they
  are not handled correctly.
- Notes: Complements `no-floating-promises`.
- Caveats: React event handlers may need careful configuration.

### TypeScript ESLint no-non-null-assertion

- URL: https://typescript-eslint.io/rules/no-non-null-assertion/
- Accessed: 2026-07-07
- Area: Null safety
- Use when: Preventing unchecked `!` assertions.
- Notes: Encourages code that proves values exist instead of bypassing the type
  system.
- Caveats: Rare generated-code or framework-boundary exceptions should be
  documented.

### TypeScript ESLint strict-boolean-expressions

- URL: https://typescript-eslint.io/rules/strict-boolean-expressions/
- Accessed: 2026-07-07
- Area: Logic safety
- Use when: Avoiding implicit truthy or falsy checks on non-boolean values.
- Notes: Makes conditions more explicit and beginner-readable.
- Caveats: Configure intentionally so optional strings and arrays are handled in
  a readable way.

### TypeScript ESLint no-unnecessary-condition

- URL: https://typescript-eslint.io/rules/no-unnecessary-condition/
- Accessed: 2026-07-07
- Area: Logic safety
- Use when: Removing conditions that types prove are always truthy, falsy, or
  nullish.
- Notes: Helps keep code and declared types aligned.
- Caveats: Can be sensitive to type declarations from dependencies.

### TypeScript ESLint switch-exhaustiveness-check

- URL: https://typescript-eslint.io/rules/switch-exhaustiveness-check/
- Accessed: 2026-07-07
- Area: Exhaustive handling
- Use when: Ensuring union and enum cases are fully handled.
- Notes: Useful for domain states, parser outcomes, and API result variants.
- Caveats: Works best with clear union types.

### ESLint complexity

- URL: https://eslint.org/docs/latest/rules/complexity
- Accessed: 2026-07-07
- Area: Code readability
- Use when: Enforcing low cyclomatic complexity.
- Notes: Caps the number of branches in a function.
- Caveats: A low max such as `3` will require frequent function extraction.

### ESLint no-restricted-imports

- URL: https://eslint.org/docs/latest/rules/no-restricted-imports
- Accessed: 2026-07-07
- Area: Architecture boundaries
- Use when: Enforcing monorepo import boundaries.
- Notes: Restricts static imports that should not cross package or app
  boundaries.
- Caveats: Dynamic imports and generated files may need separate policy.

### ESLint no-eval

- URL: https://eslint.org/docs/latest/rules/no-eval
- Accessed: 2026-07-07
- Area: Security linting
- Use when: Preventing direct `eval` usage.
- Notes: `eval` has security and performance implications.
- Caveats: Also configure `no-implied-eval` for string-based timers and similar
  patterns.

### ESLint no-implied-eval

- URL: https://eslint.org/docs/latest/rules/no-implied-eval
- Accessed: 2026-07-07
- Area: Security linting
- Use when: Preventing eval-like strings passed to timers or similar APIs.
- Notes: Complements `no-eval`.
- Caveats: Prefer function callbacks instead of strings.

### ESLint no-console

- URL: https://eslint.org/docs/latest/rules/no-console
- Accessed: 2026-07-07
- Area: Frontend production hygiene
- Use when: Restricting browser console calls in production code.
- Notes: Browser console calls are usually debugging leftovers.
- Caveats: Server code should use approved logging rather than this blanket
  browser-oriented rule.

### React Hooks exhaustive-deps

- URL: https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps
- Accessed: 2026-07-07
- Area: React correctness
- Use when: Enforcing correct hook dependency arrays.
- Notes: Helps prevent stale closures in hooks.
- Caveats: If the rule feels hard to satisfy, the hook likely needs simpler
  structure.

### JSX Accessibility ESLint Plugin

- URL: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- Accessed: 2026-07-07
- Area: Frontend accessibility
- Use when: Catching common accessibility issues in JSX.
- Notes: Performs static accessibility checks for React JSX.
- Caveats: Static linting does not replace rendered DOM testing or assistive
  technology checks.
