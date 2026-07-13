# Slice 7A: Sentry Runtime Delivery Foundation

## Status

Completed on 2026-07-09.

## Completion Scope Amendment

Daniel explicitly deferred physical-phone QA to a separate, optional session
when Slice 7A closed. Physical mobile-session and mobile-Replay proof were not
Slice 7A completion gates. The follow-up physical-phone session passed on
2026-07-10 and is recorded in the completion evidence below.

The implementation still delivers and verifies the Tailscale foundation:
Fastify remains bound to `127.0.0.1`, Vite can bind only to the current
Tailscale IPv4 interface, MagicDNS host allowlisting works, API traffic remains
proxied to localhost, and direct tailnet access to Fastify is rejected. Any
earlier mobile-proof requirements retained below describe the original plan.
They were superseded as close-out gates by this amendment and were later
satisfied through the follow-up evidence.

Slice 7A implements only the runtime delivery foundation. Slice 7B adds request
correlation and note route evidence on top of this runtime. Slice 7E then adds
semantic editor and persistence diagnostics.

## Product Decision

Azurite adopts Sentry as the development observability runtime for the local web
app and local Fastify API, but the first implementation slice proves only that
the runtime works safely.

Slice 7A settles these runtime platform decisions:

- `azurite-web` receives browser/runtime telemetry from the React app.
- `azurite-server` receives backend/runtime telemetry from the Fastify API.
- Web and server Sentry configuration is typed, local-debug gated, and safe when
  missing.
- Sentry-disabled startup avoids importing or initializing Sentry SDK and Replay
  runtime code; the current web and server entrypoints must gate those imports.
- Server startup uses a custom Azurite ESM preload loaded with `--import`; the
  preload dynamically imports `@sentry/node` only when Sentry is enabled and a
  DSN is present.
- Session Replay, structured logs, browser console warning/error capture, and
  baseline tracing are proven before later slices depend on them.
- Desktop local and mobile/Tailscale debug sessions can both deliver real web
  telemetry while the backend remains local-only behind the Vite proxy.

This slice deliberately does not hand-roll a custom logging, tracing, replay, or
investigation platform. Sentry owns event capture, logs, tracing, replay,
grouping, and investigation UI. Azurite owns a thin runtime wrapper, typed
configuration boundary, and extension surface that later slices can use without
scattering SDK calls through product code.

## User Story

When Daniel explicitly enables Sentry for local development, he can start the
Azurite web and server runtimes, trigger deliberate web and server test events,
see browser and backend telemetry in Sentry, inspect a desktop and mobile
Session Replay, confirm browser console warnings/errors reach Sentry, and verify
baseline frontend-to-backend trace propagation headers through the local proxy.

When Sentry is not explicitly enabled, Azurite behaves like the current app:
startup, note list loading, URL navigation, note reading, manual save, conflict
handling, draft recovery, local desktop development, and Tailscale development
continue without requiring a DSN or importing Sentry runtime modules.

## Why This Matters

The full Sentry observability plan needs evidence across browser replay, React
state, Milkdown, Dexie, API requests, Fastify routes, and filesystem-backed note
behavior. That full promise is too broad for one reviewable diff.

The first useful delivery unit is the runtime itself. Before request IDs, note
operation IDs, route evidence, editor events, payload helpers, or coalescing can
be trusted, Azurite must prove that Sentry can be enabled deliberately, disabled
cleanly, started in the right order, flushed on shutdown, and verified from both
desktop and mobile/Tailscale sessions.

After Slice 7A, later slices can depend on a real observability runtime instead
of debugging Sentry setup while also debugging Azurite product instrumentation.

## Future Workflow Boundary

| Boundary               | Decision                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current workflow       | Start the local web and API runtimes with Sentry explicitly enabled or cleanly disabled; prove web/server events, Replay, console capture, tracing headers through the Vite proxy, and bounded backend shutdown on desktop and Tailscale mobile access. |
| Predictable extensions | Slice 7B adds request and note-operation correlation; Slice 7E adds editor, draft, payload, and recovery diagnostics.                                                                                                                                   |
| Participating layers   | Root environment examples, Vite config, web initialization and error boundary, shared runtime contracts, server preload and lifecycle, development-only test triggers, automated tests, and desktop/mobile runtime QA.                                  |
| Near-term seams        | Typed runtime helpers accept controlled serializable attributes; shared route and event contracts allow 7B/7E to extend telemetry without another SDK setup path.                                                                                       |
| Exclusions             | Note workflow correlation, editor/Dexie/Zustand diagnostics, payload capture, source-map upload, workers, public telemetry policy, and `packages/core` instrumentation wait because the runtime can be proven independently.                            |

## Goals

- Create Sentry coverage for the current `apps/web` React browser surface.
- Create Sentry coverage for the current `apps/server` Fastify API surface.
- Create or confirm the `azurite-server` Sentry project without committing a
  DSN.
- Load local Sentry values from one root untracked `.env.local`.
- Keep typed web/server config parsing independent of the local value source.
- Keep Sentry disabled unless the enabled flag is the literal string `true` and
  a DSN is present.
- Keep Sentry-disabled startup free of Sentry SDK and Replay imports by gating
  those imports at the current web and server entrypoints.
- Initialize backend Sentry before Fastify is imported when Sentry is enabled.
- Use a custom Azurite server preload that conditionally imports Sentry only when
  enabled, while still using Sentry's Fastify integration after initialization.
- Preserve Fastify/Pino logging and graceful shutdown behavior.
- Add bounded backend Sentry flushing or closing on shutdown when enabled.
- Make the shutdown fallback budget coherent with the Sentry flush budget.
- Add base shared runtime observability types and development route constants.
- Add explicit development-only, env-gated test telemetry triggers.
- Configure Session Replay for uncensored local debug capture and prove desktop
  and mobile/Tailscale delivery.
- Capture browser console warnings/errors in Sentry.
- Require Sentry SDK versions that support structured JavaScript logs through
  `enableLogs` and `Sentry.logger` or the installed SDK's current equivalent.
- Prove browser tracing emits `sentry-trace` and `baggage` headers through the
  Vite proxy to Fastify.
- Document and verify the Tailscale/MagicDNS boot path with the backend
  local-only behind the Vite proxy.
- Verify real desktop web, mobile/Tailscale web, and backend Sentry delivery.
- Keep Azurite fully functional when Sentry env vars are missing.

## Non-Goals

- Do not add request ID or note operation ID correlation.
- Do not instrument note list/read/save/conflict route outcomes beyond the
  development-only test-event route.
- Do not add deep Milkdown, Crepe, ProseMirror, Dexie, or Zustand diagnostics.
- Do not implement full debug payload bounds or `azurite.debug_payload`.
- Do not add high-frequency editor event coalescing.
- Do not fix the Milkdown block-menu bug.
- Do not add source-map upload infrastructure.
- Do not add Sentry to future native, worker, sync, or indexing surfaces.
- Do not create a public production telemetry policy.
- Do not create a custom in-app log viewer.
- Do not persist observability events as Azurite product state.
- Do not replace existing Fastify/Pino logs with Sentry.
- Do not add direct Sentry instrumentation, observer hooks, or telemetry
  contracts to `packages/core`.

## Existing Sentry State

- Organization/workspace: `Daniel Mulec`
- Web project: `azurite-web`
- Web platform: React
- Web project URL:
  `https://daniel-mulec.sentry.io/projects/azurite-web/getting-started/`

The backend project still needs to be created:

- Backend project: `azurite-server`
- Backend platform: Fastify, using Sentry's official Fastify setup guidance after
  Azurite's custom conditional preload imports `@sentry/node`.

If the Sentry UI offers both Fastify and generic Node.js setup paths, choose
Fastify. Use the generic Node.js path only if the Fastify path is unavailable or
blocked, and record that implementation decision in the slice notes.

## Architecture

### Sentry Projects

Use two Sentry projects:

- `azurite-web` for React browser telemetry.
- `azurite-server` for Fastify API telemetry.

This split matches Azurite's current runtime boundary and Sentry's project
model. Browser/runtime events and backend/runtime events are grouped separately
while remaining joinable later through release, environment, surface, trace IDs,
and Slice 7B's Azurite request IDs.

### Configuration Boundary

Sentry configuration must be parsed through explicit web and server config
modules. Feature code must consume typed config objects and helper APIs, not raw
`import.meta.env` or `process.env` reads.

Preferred local development workflow:

- Commit one root `.env.example` with placeholder values for every supported
  Sentry variable.
- Use one root untracked `.env.local` for Daniel's real local Sentry values.
- Keep `.env.local`, real DSNs, Sentry auth tokens, and unrelated local
  credentials out of Git.
- Treat `.env.local` only as the local development value source. Future
  production, showcase, or packaged deployments may inject the same variables
  through platform-managed environment variables or secret stores without
  changing Sentry feature code.

Web variables:

- `VITE_SENTRY_ENABLED`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`
- `VITE_SENTRY_TRACE_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE`
- `VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE`
- `VITE_SENTRY_TEST_EVENTS_ENABLED`

Server variables:

- `SENTRY_ENABLED`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`
- `SENTRY_TRACE_SAMPLE_RATE`
- `SENTRY_TEST_EVENTS_ENABLED`

Exact loading mechanism:

- `apps/web/vite.config.ts` sets Vite's `envDir` to the repository root so the
  web app reads the root `.env.local` and exposes only `VITE_*` values to client
  code.
- `apps/web/src/config/sentry-config.ts` parses `import.meta.env` into a typed
  web Sentry config.
- The web entrypoint checks the parsed config before importing Sentry browser
  SDK and Replay runtime modules. Sentry-disabled startup must not import
  `@sentry/react`, configure Replay, or initialize Sentry.
- The server custom ESM preload loads the root `.env.local` before
  instrumentation by using Node 26's built-in environment-file support from a
  small server-local env module.
- Missing `.env.local` keeps normal Sentry-disabled startup working.
- `apps/server/src/config/sentry-config.ts` parses `process.env` into a typed
  server Sentry config.
- The server custom preload checks parsed server config before importing Sentry
  runtime modules. Sentry-disabled startup must not import `@sentry/node`,
  initialize Sentry, or await Sentry shutdown work.
- Enabled flags use the literal string `true`. Missing, empty, or invalid flags
  are disabled.
- Sample-rate values must parse to numbers in the inclusive `0..1` range.
  Invalid values fall back to documented debug defaults without crashing local
  startup.

### Source Maps And Release Metadata

Slice 7A uses release naming plus local development source maps. It does not add
source-map upload infrastructure.

Production-like source-map upload is deferred until Azurite has a
production-like build/distribution slice. That later work should evaluate
`@sentry/vite-plugin`, Sentry auth tokens, organization/project slugs,
build-only environment loading, and uploaded artifact verification as one
focused release-observability task.

### Server Preload Contract

Sentry must initialize before Fastify is imported when Sentry is enabled, but
Sentry-disabled startup must not import `@sentry/node`.

Use a custom Azurite ESM preload file loaded through the real `tsx` dev/start
path:

```sh
tsx --import ./src/sentry-preload.mjs src/index.ts
```

The custom preload is intentionally not `@sentry/node/preload`, because the
official Sentry preload imports Sentry code unconditionally. Azurite's disabled
mode guarantee is stronger: the custom preload loads local env, parses config
without importing Sentry, returns immediately when disabled, and dynamically
imports `@sentry/node` only when enabled and a DSN is present.

The `.mjs` preload file is the required external-tooling exception to Azurite's
TypeScript-script preference. This exception is justified because the file is
loaded by Node before TypeScript app modules and before Fastify can be imported.

Accepted behavior:

- Sentry-enabled server startup initializes Sentry before `fastify` is loaded.
- Sentry-enabled server startup uses Sentry's Fastify integration after dynamic
  import and initialization.
- Sentry-disabled server startup does not require a DSN and preserves current
  startup behavior without importing `@sentry/node`.
- Existing Fastify/Pino logging remains intact.
- Automated startup tests prove the real `tsx` dev/start path loads the custom
  preload before `apps/server/src/app.ts` imports Fastify.
- Automated disabled-mode startup tests prove the custom preload returns before
  Sentry SDK import or initialization when `SENTRY_ENABLED` is not `true` or the
  DSN is missing.
- The required `.mjs` preload file is the only `.mjs` exception introduced by
  this slice and is documented where the file or package script is defined.

If implementation discovers that the custom preload cannot preserve Sentry's
Fastify integration while also avoiding disabled-mode imports, stop and revise
the slice. Do not silently fall back to unconditional `@sentry/node/preload`.

### Backend Shutdown Boundary

Graceful shutdown must give Sentry a short chance to send queued backend
telemetry without making Azurite hang forever. The enabled-mode fallback budget
must be longer than the Sentry flush/close budget.

Accepted shutdown behavior:

- Sentry-enabled shutdown closes Fastify first, then flushes or closes the Sentry
  SDK, then exits.
- The initial Sentry flush/close timeout is `1000ms`.
- The Sentry-enabled fallback exit delay is `1500ms`, so the fallback cannot beat
  a normal `1000ms` Sentry flush.
- Sentry-disabled shutdown follows the current Fastify/Pino behavior and keeps
  the current `500ms` fallback unless implementation proves a single shared
  fallback is simpler and tests preserve the disabled-mode user experience.
- Existing `SIGINT`/`SIGTERM` behavior and fallback exit protection remain
  intact.
- Tests simulate Sentry-enabled signal shutdown and prove Fastify close plus
  Sentry flush/close complete before process exit when the flush resolves within
  budget.
- Tests simulate a hung Sentry flush and prove fallback exit protection still
  wins.

### Tailscale And MagicDNS Runtime Proof

Mobile/Tailscale proof is part of Slice 7A because runtime delivery must be
verified from Daniel's real phone path before correlation and editor diagnostics
depend on it.

Implementation requirements:

- Preserve the backend on `127.0.0.1:3000` for phone QA when the frontend can
  proxy API requests.
- Add or preserve a documented Vite boot path that binds the frontend only to the
  needed Tailscale interface for the current session.
- Read the current Tailscale hostname and IP from `tailscale status --self
--json` during manual QA.
- Use `Self.DNSName` as the MagicDNS hostname in Daniel-facing URLs.
- Use the first IPv4 address in `TailscaleIPs` as the Vite bind host.
- Add or preserve Vite `allowedHosts` support for the MagicDNS hostname, such as
  the existing architecture's `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` workflow.
- Confirm the phone loads the web app through the MagicDNS URL and API requests
  still proxy to the local-only backend.
- Confirm the mobile/Tailscale web session and Replay arrive in `azurite-web`.

### URL-Driven Dev Diagnostics Boundary

The web development test trigger remains URL-driven, but its URL state must be
part of the typed router contract instead of an incidental query string.

Accepted URL behavior:

- The preferred diagnostics URL is `/?note=index.md&azurite-dev=sentry-test`.
- TanStack Router search parsing explicitly accepts and exposes
  `azurite-dev=sentry-test`.
- Startup note selection, list-click note navigation, and browser-history note
  navigation preserve the `azurite-dev` value when it is present.
- Invalid or absent `azurite-dev` values are ignored without changing selected
  note behavior.
- The diagnostics panel renders only when `import.meta.env.DEV` is true,
  `VITE_SENTRY_TEST_EVENTS_ENABLED=true`, and the parsed dev diagnostics state
  is `sentry-test`.

### Runtime Telemetry Carrier Boundary

Slice 7A establishes the runtime carrier mapping but keeps request correlation,
note route evidence, payload-heavy diagnostics, and semantic editor diagnostics
for later slices.

Accepted Replay behavior:

- Replay initializes only when web Sentry is explicitly enabled with a DSN.
- Replay SDK imports are skipped when web Sentry is disabled.
- The default debug Replay sample rates in `.env.example` make Replay delivery
  visible for local Sentry-enabled sessions unless Daniel lowers them.
- The Replay integration is configured through TypeScript-supported SDK options.
- Slice 7A configures uncensored debug Replay defaults through the installed
  SDK's supported options, such as `maskAllText: false`,
  `maskAllInputs: false`, and `blockAllMedia: false` or the current equivalent.
- Tests prove the parsed Replay configuration uses the uncensored debug defaults
  when Sentry is explicitly enabled.
- Runtime replay QA confirms a simple development diagnostics marker is visible
  in Replay without default text masking.
- Runtime replay QA confirms one desktop Replay and one mobile/Tailscale Replay
  arrive in `azurite-web`.
- Slice 7A does not need to prove that Milkdown editor text, textarea text,
  selection context, or block-menu context are useful in Replay. Slice 7E proves
  and adjusts that semantic editor-debugging fidelity.

Accepted logs, console, and tracing behavior:

- Web and server SDK versions support structured logs.
- Sentry initialization enables logs explicitly with `enableLogs` or the current
  SDK equivalent.
- Runtime lifecycle/result events use `Sentry.logger` or the current SDK
  equivalent as the primary structured log carrier.
- Frontend production code does not use `console.log` as the primary Azurite
  event path.
- Browser console warnings and errors are captured as Sentry breadcrumbs, logs,
  or SDK-supported console integration evidence so incidental third-party and
  browser runtime warnings are available in Sentry.
- Backend Sentry logs are additive and do not replace or weaken Fastify/Pino
  logs.
- Browser and backend tracing both use explicit parsed sample rates.
- Tests or browser QA prove eligible frontend API requests include
  `sentry-trace` and `baggage` headers and those headers reach the Fastify
  request boundary through the Vite proxy.
- Manual Sentry UI QA proves that a sampled API call can be inspected as a
  frontend-to-backend trace where the installed SDK supports it.

Runtime mapping:

- Logs are the primary carrier for runtime lifecycle/result events.
- Breadcrumbs are the lightweight chronological trail for runtime startup,
  browser console warnings/errors, dev test triggers, and request traces.
- Spans measure web runtime initialization, deliberate test events, backend
  request handling for the test route, and baseline traced API calls.
- Tags carry low-cardinality filter dimensions such as `app.surface`,
  environment, release, route pattern, result status, and test-event status.
- Context and structured attributes carry release, environment, surface, route,
  method, test-event status, trace header presence, and durations.
- Errors and captured exceptions are reserved for real failures, deliberate
  development test events, and error-boundary captures.
- Breadcrumbs must not carry full markdown or draft payloads.
- Slice 7A test events may include small explicit marker payloads that prove
  event context delivery. They must not implement the full Slice 7E
  `azurite.debug_payload` under-limit and over-limit contract.

### Runtime Helper Extension Surface

Direct Sentry calls must stay behind small observability modules instead of
being scattered through feature code.

Required modules:

- web Sentry initialization
- web runtime observability helpers
- server Sentry initialization
- server runtime observability helpers
- shared route constants
- shared base runtime observability types

The 7A observability helpers must expose a concrete typed runtime event/context
surface that later slices can extend without importing Sentry from feature code
or forking the 7A event shape.

The shared package should export a shape equivalent to:

```ts
export type RuntimeObservabilitySurface = "web" | "server";

export type RuntimeObservabilityPrimitive =
  string | number | boolean | null | undefined;

export type RuntimeObservabilityAttributes = Readonly<
  Record<string, RuntimeObservabilityPrimitive>
>;

export type RuntimeObservabilityEvent = {
  readonly name: string;
  readonly surface: RuntimeObservabilitySurface;
  readonly attributes?: RuntimeObservabilityAttributes;
};
```

Implementation may choose stricter local names, unions, or helper wrappers, but
it must provide the same product capability:

- shared event names and attributes can be imported by web and server code
- helper calls accept common runtime context
- helper calls accept controlled additional serializable attributes
- helper calls do not require feature code to import Sentry
- a compile-time or unit-test fixture proves a fake Slice 7B correlated note
  event can
  use the 7A helper surface without direct Sentry imports or an event-shape fork

Slice 7A does not need to implement request IDs, note operation IDs,
`azurite.debug_payload`, snapshots, or editor event names, but it must not
hard-code helper shapes that would force later slices to bypass the runtime
helpers.

Sentry debug mode is intentionally uncensored. Runtime instrumentation may send
diagnostic context when Sentry is explicitly enabled, but it must not own product
decisions, editor state, draft state, route state, save behavior, or cluster
state.

## Runtime Event Contract

### Shared Event Naming Rules

- Event names use lower-case dot-separated product vocabulary.
- Event names describe Azurite behavior, not Sentry mechanics.
- Every started event has a matching succeeded, failed, stale, conflict,
  invalid, or visible result when that lifecycle exists.
- Event attributes use shared constants for common fields where they are reused
  across web and server.
- Slice 7A events carry runtime metadata and bounded marker context, not full
  markdown or draft payloads.

### Runtime Events

| Event                                  | Required attributes                                     |
| -------------------------------------- | ------------------------------------------------------- |
| `telemetry.web.test.triggered`         | release, environment, surface, test marker              |
| `telemetry.server.test.triggered`      | release, environment, surface, test marker              |
| `telemetry.runtime.console.captured`   | surface, console level, message summary                 |
| `telemetry.runtime.trace_headers.seen` | surface, route, method, sentry-trace seen, baggage seen |
| `telemetry.runtime.shutdown.started`   | surface, signal                                         |
| `telemetry.runtime.shutdown.flushed`   | surface, duration, flush result                         |
| `telemetry.runtime.shutdown.failed`    | surface, duration, error details                        |

Implementation may add more specific runtime events when useful, but it must not
add note workflow events in Slice 7A. Note list/read/save/conflict events belong
to Slice 7B.

## Implementation Plan

### 1. Confirm The Canonical Slice Boundary

Confirm this is the only active product slice before implementation begins.

Implementation requirements:

- Keep this active 7A proposal focused on runtime delivery only.
- Treat the 7B and 7E documents in `docs/slices/planned/` as future handoffs,
  not concurrent implementation authority.
- Use Git history for superseded Sentry drafts instead of restoring backup files.

### 2. Create The Backend Sentry Project

Create `azurite-server` in the existing `Daniel Mulec` Sentry workspace.

Project setup requirements:

- Use Sentry's official Fastify setup guidance after the custom Azurite preload
  dynamically imports the SDK.
- Keep the new Sentry setup page available long enough to copy the backend DSN
  into Daniel's local environment.
- Do not commit the backend DSN.

### 3. Add Dependencies

Add Sentry packages to the owning workspaces:

- `@sentry/react` in `apps/web`
- `@sentry/node` in `apps/server`

The selected package versions must support:

- structured JavaScript logs through `enableLogs` and `Sentry.logger` or the
  current SDK equivalent
- Replay configuration options needed for uncensored local debug capture
- browser console warning/error capture through an SDK-supported integration or
  equivalent Sentry evidence path
- browser and backend tracing for baseline API trace propagation

Do not add `@sentry/vite-plugin` in this slice. Source-map upload belongs to a
future release-observability slice that can safely introduce Sentry auth token
handling.

### 4. Add Environment Documentation, Runbook, And Config Parsing

Add committed environment examples and typed config parsing without secrets.

Implementation requirements:

- Create or update root `.gitignore` rules so `.env.local` remains untracked.
- Create root `.env.example` with placeholder values for every supported web and
  server Sentry variable.
- Create a `sentry-debug.md` runbook in `docs/runbooks/` as the operator-facing
  source for the implemented local debug workflow.
- Document the preferred root `.env.local` workflow in that runbook.
- Document that future non-local deployments can inject the same variables
  through their environment or secret system without using `.env.local`.
- Document how to enable and disable Sentry locally.
- Document which variables are required for web telemetry and server telemetry.
- Document how Replay and trace sample rates affect local debug sessions.
- Document that local debug Replay is intentionally uncensored when Sentry is
  explicitly enabled, and that disabled mode skips Sentry SDK/Replay imports at
  the current web and server entrypoints.
- Document how to enable deliberate web and server test events.
- Link to `docs/runbooks/tailscale-phone-access.md` and document only the
  additional Sentry verification required on that path.
- Document that Azurite remains runnable and fully functional without Sentry
  values.
- Add web and server Sentry config modules with typed parsing and tests.
- Use literal `true` as the only enabled value for Sentry and test events.
- Default Sentry to disabled whenever DSN or enabled flag is missing.
- Apply the credential-containment rules from
  `docs/reference/product-guardrails.md`; product data may be uncensored in
  explicit debug mode, but credentials and secret values must not be
  deliberately captured or committed.

### 5. Add Shared Runtime Constants And Helper Types

Create shared runtime route constants and helper types in `packages/shared`.

Implementation requirements:

- `POST /__azurite/dev/sentry-test-event` is added to shared route constants and
  reference docs as a development-only route registered only when the server
  test-event env gate is enabled.
- Runtime event names for development test events, trace-header proof, and
  shutdown evidence are shared where both web and server need them.
- Attribute names for release, environment, app surface, route pattern, result
  status, and test-event status are shared.
- Export the typed runtime event/context surface described in this proposal.
- Add a compile-time or unit-test fixture proving a fake Slice 7B correlated note
  event can use the 7A helper surface without importing Sentry or forking the
  event shape.
- Exported constants and types include beginner-readable TSDoc.

### 6. Initialize Web Sentry

Initialize Sentry before the React app renders, but only when enabled.

Implementation requirements:

- Initialize only from the parsed web Sentry config when
  `VITE_SENTRY_ENABLED=true` and `VITE_SENTRY_DSN` is present.
- Use dynamic imports or an equivalent entrypoint split so Sentry-disabled web
  startup skips `@sentry/react` and Replay runtime imports.
- Tag events with `app.surface = web`.
- Set `environment` and `release` from env/config.
- Enable React/browser error capture.
- Enable JavaScript logs through `enableLogs` and `Sentry.logger` or the current
  installed SDK equivalent.
- Enable Session Replay for explicitly enabled debug sessions.
- Configure Replay using the installed SDK's TypeScript options with uncensored
  debug defaults, including unmasked text/input and unblocked media options where
  supported.
- Set default debug Replay sample rates in `.env.example` so a Sentry-enabled
  local session produces Replay delivery unless Daniel lowers the values.
- Enable browser tracing with env-configurable sampling.
- Configure trace propagation targets for same-origin `/api/*`, localhost, and
  Tailscale/MagicDNS Azurite API paths used during development.
- Capture browser console warnings/errors through the SDK-supported console
  integration, breadcrumb integration, log integration, or current equivalent.
- Keep raw env reads inside `apps/web/src/config/sentry-config.ts` and Sentry
  initialization code.
- Add a React error boundary around the app shell or editor surface without
  changing normal UI behavior.
- Keep Sentry-disabled rendering behavior unchanged.

### 7. Initialize Server Sentry

Initialize Sentry before Fastify is imported by using Azurite's custom ESM
preload.

Implementation requirements:

- Load the root `.env.local` before instrumentation in local development.
- Return from the preload before importing Sentry runtime modules when server
  Sentry is disabled.
- Initialize only from the parsed server Sentry config when
  `SENTRY_ENABLED=true` and `SENTRY_DSN` is present.
- Dynamically import `@sentry/node` only after config proves Sentry is enabled.
- Tag events with `app.surface = server`.
- Set `environment` and `release` from env/config.
- Use Sentry's Fastify integration after SDK import and initialization.
- Enable backend structured logs through `enableLogs` and `Sentry.logger` or the
  current installed SDK equivalent.
- Enable backend tracing with the parsed `SENTRY_TRACE_SAMPLE_RATE`.
- Keep raw env reads inside server option/config modules and Sentry
  initialization code.
- Keep existing Fastify/Pino logging intact.
- Capture unhandled backend errors.
- Capture route/request errors without weakening existing error responses.
- Update the real server `dev` and `start` scripts so the `tsx` startup path
  uses the custom Azurite preload before `src/index.ts`.
- Document the `.mjs` preload file as the required external-tooling exception to
  the repository's TypeScript-script preference.
- Verify that Sentry-disabled startup still works without a DSN.
- Verify that Sentry-disabled startup does not import or initialize
  `@sentry/node`.
- Verify that the Sentry-enabled real `tsx` startup path initializes Sentry
  before Fastify is imported.

### 8. Add Bounded Server Shutdown Flushing

Add Sentry flushing or closing to graceful shutdown without weakening disabled
mode.

Implementation requirements:

- Keep shutdown handlers in the server entrypoint/lifecycle boundary, not route
  modules.
- Close Fastify before flushing or closing Sentry.
- Use an initial Sentry flush/close timeout of `1000ms`.
- Use an enabled-mode fallback exit delay of `1500ms`.
- Preserve disabled-mode shutdown behavior and the current `500ms` fallback
  unless implementation records and tests a deliberate simplification.
- Test clean Sentry-enabled shutdown, hung Sentry-enabled shutdown, and
  Sentry-disabled shutdown.

### 9. Add Deliberate Test Events

Add development-only ways to prove telemetry works without throwing accidental
real product errors.

Implementation requirements:

- Web test events are available only when `import.meta.env.DEV` is true and
  `VITE_SENTRY_TEST_EVENTS_ENABLED=true`.
- The web trigger is not part of the normal note workflow. Use an explicit
  URL-driven development diagnostics panel at
  `/?note=index.md&azurite-dev=sentry-test` that is hidden unless dev mode, test
  events, and the parsed `azurite-dev=sentry-test` state are all active.
- The web trigger requires an intentional click or command to send the event.
- `azurite-dev=sentry-test` is an explicitly parsed TanStack Router search param
  and startup note selection, note-list navigation, and browser-history note
  navigation preserve it when present.
- Server test events are available only when `NODE_ENV` is not `production` and
  `SENTRY_TEST_EVENTS_ENABLED=true`.
- The server trigger is the development-only route
  `POST /__azurite/dev/sentry-test-event`, registered only when test events are
  enabled.
- The server test-event route is defined in shared route constants and marked
  development-only in reference docs.
- Server test-event requests require an explicit confirmation header such as
  `x-azurite-dev-test-event: sentry`.
- Test events are impossible to trigger accidentally in normal user workflows.
- Test events do not write notes, read or create cluster metadata, mutate draft
  state, or change route state.
- Test events include release, environment, surface, and a clearly marked
  `azurite.test_event = true` attribute.
- Test events exercise the same runtime logs/breadcrumbs/spans/tags/context
  carrier mapping used by real Slice 7A observability events.
- Web test events include a simple visible diagnostics marker that manual Replay
  QA can use to confirm runtime Replay text is not masked in local debug mode.
- Test events do not implement the full Slice 7E under-limit and over-limit
  debug payload contract.

### 10. Add Tailscale Runtime QA Support

Make the phone access proof operational instead of only aspirational.

Implementation requirements:

- Add or preserve Vite config support for a MagicDNS hostname allowlist supplied
  at boot time.
- Keep the backend on `127.0.0.1:3000` while Vite proxies API requests.
- Document the exact commands for the current-session Tailscale boot path.
- Include manual QA steps for reading `tailscale status --self --json`, using
  `Self.DNSName` for the browser URL, and binding Vite to the first IPv4
  `TailscaleIPs` value.
- Confirm desktop local and phone MagicDNS sessions can both reach the app.
- Confirm the phone path creates a distinct Sentry web session and Replay.

### 11. Refactor Before Instrumenting Near-Limit Files

Split files before adding runtime instrumentation to modules that are already
close to the 400-line hard limit.

Implementation requirements:

- Keep every code file at 400 lines or fewer.
- Extract frontend runtime observability helpers before expanding route actions
  or app entrypoints.
- Extract backend runtime observability helpers before expanding server startup
  or lifecycle modules.
- Avoid adding deep instrumentation to `MilkdownEditor.tsx` in this slice.
- Preserve existing tests while adding focused tests for extracted helpers.

### 12. Verify With Real Runtime

Run automated validation and then verify through Sentry UI.

Required QA:

- Azurite starts without `.env.local` and behaves like the current
  Sentry-disabled app.
- Sentry-disabled web startup does not import `@sentry/react` or Replay runtime
  modules.
- Sentry-disabled server startup does not import `@sentry/node`.
- Azurite starts with root `.env.local` and both parsed Sentry configs report
  enabled only when the enabled flag is `true` and the DSN is present.
- A local desktop browser sends a web test event to `azurite-web`.
- The local backend sends a server test event to `azurite-server`.
- A browser console warning/error appears in Sentry as SDK-supported console
  evidence.
- A diagnostics marker appears in Replay without default text masking.
- A local desktop Session Replay appears in `azurite-web`.
- A sampled frontend `/api/*` call emits `sentry-trace` and `baggage` headers
  that reach the Fastify request boundary through the Vite proxy.
- The backend remains local-only while the frontend proxies API requests for
  Tailscale/phone QA.
- A mobile/Tailscale browser session appears as a distinct web session.
- A mobile/Tailscale Session Replay appears in `azurite-web`.
- Sentry-enabled shutdown stays bounded while pending backend telemetry is
  flushed or closed.
- Sentry-disabled startup and note workflow remain unchanged.

## Negative Side-Effect Guardrails

Baseline: `docs/reference/product-guardrails.md`.

Slice-specific guardrails:

- Sentry-disabled startup must not import or initialize Sentry SDK, Replay, or
  shutdown work at the current web and server entrypoints.
- The custom server preload must initialize Sentry before Fastify only when
  enabled; failure must not create a second server startup path.
- The Sentry flush timeout must remain shorter than the enabled-mode fallback
  exit budget so normal shutdown can complete.
- Development test triggers must remain explicit, environment-gated,
  development-only, and non-mutating.
- The typed `azurite-dev=sentry-test` search parameter must survive existing
  note navigation and browser-history transitions without becoming product
  state.
- Tailscale QA must keep the backend on localhost and expose only the Vite
  frontend through the required tailnet interface.

## Verification Plan

Run the full repository validation:

```sh
/opt/homebrew/bin/pnpm validate
```

Run targeted automated tests for:

- root `.env.local` loading path and missing-file behavior
- web Sentry config parsing from `import.meta.env`
- server Sentry config parsing from `process.env`
- Sentry-disabled web initialization without importing `@sentry/react` or Replay
  runtime modules
- Sentry-enabled web initialization with mocked SDK calls
- web Replay config using the installed SDK's supported option names
- web Replay config using uncensored debug defaults when explicitly enabled
- web Replay sample-rate defaults that produce Replay delivery in explicitly
  enabled local debug sessions unless Daniel lowers them
- browser console warning/error capture through the selected SDK integration or
  equivalent Sentry evidence path
- web trace propagation targets including `/api/*`
- eligible frontend API requests carrying `sentry-trace` and `baggage` headers
  through the Vite proxy to the Fastify request boundary
- Vite MagicDNS allowed-host support without exposing the backend
- Sentry-disabled server initialization without importing `@sentry/node`
- Sentry-enabled real `tsx` server startup using the custom ESM `--import`
  preload before Fastify import
- server graceful shutdown flushes/closes Sentry with a bounded timeout when
  enabled and preserves existing disabled-mode shutdown behavior
- server signal shutdown with Sentry enabled proving the `1000ms` Sentry flush
  budget completes before the `1500ms` fallback when the flush resolves
- hung Sentry flush proving fallback exit protection still wins
- server tracing using the parsed `SENTRY_TRACE_SAMPLE_RATE`
- Sentry-enabled server test route instrumentation with mocked SDK calls
- web and server runtime carrier mapping for logs, breadcrumbs, spans, tags,
  context, and errors
- web and server structured log helpers using `Sentry.logger` or the current SDK
  equivalent, not `console.log`, as the primary event path
- web and server runtime observability helpers accepting controlled additional
  serializable attributes so Slice 7B can extend events without direct Sentry
  calls from feature code
- compile-time or unit-test fixture proving a fake Slice 7B correlated note
  event can use the 7A helper surface without importing Sentry or forking the
  event shape
- development test-event triggers being unavailable when env flags are missing
  and available only in development when explicitly enabled
- router parsing and preserving `azurite-dev=sentry-test` during startup note
  selection, note-list navigation, and browser-history navigation
- shared route constants and reference docs for the development-only backend
  test-event route
- existing route, draft, save, conflict, and recovery tests

Run manual/browser QA:

- Start Azurite locally without `.env.local` and confirm Sentry-disabled startup
  and note workflows behave like the current app.
- Create or update root `.env.local` with web and server Sentry env vars, then
  start Azurite locally.
- Open the local desktop URL on desktop Chrome.
- Open `/?note=index.md&azurite-dev=sentry-test`, confirm the dev diagnostics
  panel appears only when the web test-event env gate is enabled, then navigate
  between notes and confirm the `azurite-dev` search param is preserved.
- Trigger the explicit web development test event and confirm it reaches
  `azurite-web` with `azurite.test_event = true`.
- Confirm the diagnostics marker text is visible in the resulting Replay without
  default text masking.
- Trigger or observe a browser console warning/error and confirm it appears in
  Sentry as SDK-supported console evidence.
- Trigger the explicit server development test event with the confirmation
  header and confirm it reaches `azurite-server` with
  `azurite.test_event = true`.
- Confirm a desktop Session Replay appears in `azurite-web`.
- Confirm eligible frontend API requests include `sentry-trace` and `baggage`
  headers and the headers reach the Fastify request boundary through the Vite
  proxy.
- Read `tailscale status --self --json`.
- Use `Self.DNSName` as the MagicDNS hostname.
- Bind Vite only to the needed Tailscale IPv4 address from `TailscaleIPs`.
- Keep the backend on `127.0.0.1:3000`.
- Open the MagicDNS URL on mobile.
- Confirm mobile appears as a distinct Sentry web session.
- Confirm a mobile/Tailscale Session Replay appears in `azurite-web`.
- Confirm the backend remains local-only while the frontend proxies API requests
  for Tailscale/phone QA.
- Stop the backend with Sentry enabled and confirm shutdown stays bounded while
  pending backend telemetry is flushed or closed.

## Acceptance Criteria

- `azurite-web` receives real telemetry from desktop Azurite.
- Tailscale runtime support is implemented and network-boundary verified;
  physical-phone telemetry proof is deferred under the completion scope
  amendment.
- `azurite-server` receives real telemetry from the local Fastify API.
- Root `.env.example` documents the local Sentry workflow and root `.env.local`
  remains untracked.
- The Sentry debug runbook covers enable/disable behavior, required web and
  server variables, Replay and trace sample rates, deliberate test-event flags,
  Tailscale verification, credential containment, and Sentry-disabled startup
  behavior.
- Web and server Sentry config parsing is centralized behind typed config
  modules and Sentry stays disabled unless enabled flags and DSNs are present.
- Sentry-disabled web startup does not import `@sentry/react` or Replay runtime
  modules, and Sentry-disabled server startup does not import `@sentry/node`.
- Web and server Sentry package versions support structured logs through
  `enableLogs` and `Sentry.logger` or the current SDK equivalent.
- Server Sentry initialization uses the custom Azurite ESM `--import` preload
  under the real `tsx` dev/start path and initializes before Fastify imports
  only when enabled.
- The `.mjs` preload file is documented as the required external-tooling
  exception to the repository's TypeScript-script preference.
- Sentry-enabled graceful backend shutdown flushes/closes queued Sentry
  telemetry with a `1000ms` timeout and a fallback exit budget that cannot beat a
  normal flush.
- Sentry-disabled shutdown behavior remains unchanged.
- Frontend and backend events include shared release/environment metadata.
- Desktop Session Replay delivery is proven in `azurite-web`; physical-phone
  Replay proof is deferred, and Slice 7E owns editor-specific Replay usefulness.
- Replay uses uncensored local debug defaults when explicitly enabled, and a
  diagnostics marker is visible without default text masking.
- Browser console warnings/errors are captured in Sentry so incidental editor or
  runtime warnings are available to later slices.
- Runtime lifecycle/result events use structured Sentry logs as the primary
  event carrier instead of frontend `console.log`.
- Frontend API calls and backend requests are trace-correlatable through Sentry
  where supported.
- Eligible frontend API requests emit `sentry-trace` and `baggage` headers and
  those headers reach the Fastify boundary through the Vite proxy. Any direct
  cross-origin local/Tailscale API path documents and verifies the required
  CORS/header allowlist.
- Development test telemetry triggers are dev-only, env-gated, impossible to
  reach through normal note workflows, and do not mutate notes, drafts, routes,
  or cluster metadata.
- `azurite-dev=sentry-test` is a typed router search param, uses the preferred
  URL `/?note=index.md&azurite-dev=sentry-test`, and is preserved during startup
  note selection, note-list navigation, and browser-history navigation.
- `POST /__azurite/dev/sentry-test-event` is defined in shared route constants,
  documented as development-only, and registered only when the server test-event
  env gate is enabled.
- Web and server observability helpers expose a typed runtime event/context
  surface that accepts controlled additional serializable attributes, so Slice 7B
  can add request IDs, note operation IDs, and note route evidence without direct
  Sentry imports or event-shape forks.
- A compile-time or unit-test fixture proves a fake Slice 7B correlated note
  event can use the 7A helper surface.
- Sentry-disabled Azurite behaves the same as before this slice.
- Slice 7B can add request correlation and note route evidence without changing
  the runtime startup, config, project, preload, shutdown, Replay, console, or
  tracing foundations established here.
- All negative side-effect guardrails remain true.
- `/opt/homebrew/bin/pnpm validate` passes.
- The repository is clean and pushed on `main`.

## Completion Evidence

Slice 7A delivered the Sentry runtime foundation on `main` in implementation
commit `f347a85` plus the final review corrections recorded in this close-out:

- `@sentry/react` and `@sentry/node` 10.64.0 are owned by the web and server
  workspaces respectively. Current official React, Replay, logs, tracing,
  Node/Fastify, and initialization guidance plus installed types/exports were
  verified before implementation.
- Root `.env.example`, typed web/server config modules, optional root
  `.env.local` loading, and tests prove that only literal `true` plus a non-empty
  DSN enables each runtime. The real `.env.local` remained ignored and no DSN or
  credential was committed.
- Disabled web initialization returns before the dynamic browser runtime import.
  The custom Azurite ESM preload returns before `@sentry/node` import when
  disabled and initializes Sentry's supported Fastify 5 diagnostics-channel
  integration before Fastify when enabled. Real `tsx --import` probes cover both
  paths.
- Enabled server initialization sets global `app.surface = server` and runtime
  context so automatic Fastify and unhandled-error events carry the same surface
  identity as helper-emitted events.
- Web Replay uses `maskAllText: false`, `maskAllInputs: false`, and
  `blockAllMedia: false`. Structured logs, warning/error console capture,
  browser tracing, Fastify tracing, error capture, and explicit release,
  environment, and surface metadata are configured through runtime adapters.
- Shared Sentry-free event/attribute/route contracts and typed web/server helper
  surfaces accept controlled extra scalar attributes. The fake Slice 7B fixture
  compiles and runs without importing Sentry from feature code.
- The URL-gated diagnostics panel and confirmed development-only server route
  are env-gated and non-mutating. Router tests prove `azurite-dev=sentry-test`
  survives startup replacement, list navigation, and browser history.
- Graceful shutdown closes Fastify before a `1000ms` enabled Sentry flush, then
  uses a bounded `400ms` follow-up flush to deliver the recorded result. The
  `1500ms` enabled fallback remains longer than both budgets together; disabled
  shutdown preserves its `500ms` fallback. Tests cover clean, failed, and hung
  flush behavior plus result-delivery ordering.
- `/opt/homebrew/bin/pnpm validate` passed formatting, the 400-line gate, lint,
  script/workspace typechecks, and 192 tests: shared 38, core 40, web 82, and
  server 32. `/opt/homebrew/bin/pnpm build` and `git diff --check` also passed.
- Enabled desktop browser QA delivered deliberate web and server issues,
  structured web/server logs, the console warning, an unmasked Replay marker,
  `sentry-trace` and `baggage` at Fastify, and one joined browser-to-Fastify
  trace. Sentry's intentional new-issue email independently confirmed the
  backend event and configured local-debug metadata.
- Disabled desktop QA preserved note listing, reading, URL navigation, source
  editing, and manual save in a disposable cluster; the diagnostics panel was
  absent and the development route returned `404`.
- Tailscale support passed the Vite allowlist integration test and a live
  current-session network-boundary check: Vite served the MagicDNS origin from
  only the selected tailnet interface, proxied `/api/notes`, Fastify listened
  only on `127.0.0.1:3000`, and its tailnet address was unreachable directly.
- `packages/core` remains Sentry-free. Fastify/Pino and the existing note,
  routing, save, conflict, draft, recovery, filesystem, and lifecycle suites all
  remain green.
- Follow-up physical-phone QA on 2026-07-10 used Android Chrome on a Pixel 6
  through the current MagicDNS origin. The phone delivered deliberate web and
  server events, reported `sentry-trace=true` and `baggage=true`, and appeared
  as a distinct live `azurite-web` Replay with the full unmasked marker visible.
  Sentry received the matching server issue, Vite remained bound only to the
  current Tailscale interface, and Fastify remained reachable only through the
  localhost proxy.
- The same disposable phone session saved a WYSIWYG edit through
  `PUT /api/notes/content` with a `200` response. It also exposed a Markdown
  source-mode newline reversion and an unexplained recovered-draft state. Those
  editor findings do not weaken the 7A runtime proof and are recorded in
  `docs/qa/mobile-markdown-newline-reversion.md` for the 7E diagnostic handoff
  and a later editor-correctness slice.

Slice 7B remains planned and unpromoted. Its phone-QA prerequisite is complete;
7B must now be refreshed against the implemented helper/runtime contracts and
the recorded mobile editor findings before promotion.

## Handoff To Slice 7B

Slice 7B may begin only after Slice 7A proves:

- Sentry-enabled and Sentry-disabled startup both work.
- Sentry-disabled startup skips Sentry SDK and Replay runtime imports at the
  current web and server entrypoints.
- Web and server Sentry projects receive real events.
- Desktop and physical-phone web sessions and Session Replays are visible in
  Sentry, with the phone Replay distinct from the desktop Replay.
- Replay debug defaults are uncensored at the runtime configuration layer, with
  editor-specific usefulness left to 7E.
- Browser console warning/error capture is visible in Sentry.
- Structured Sentry logs and sampled frontend-to-backend tracing work as runtime
  carriers.
- `sentry-trace` and `baggage` propagation is verified through the Vite proxy and
  Fastify request boundary.
- The custom server preload initializes Sentry before Fastify only when enabled
  and imports no Sentry SDK when disabled.
- Sentry-enabled shutdown has a coherent flush/fallback budget.
- The Tailscale/MagicDNS path is documented and verified from a physical phone,
  with the backend local-only behind the Vite proxy.
- Shared route constants and base runtime observability types exist.
- Direct Sentry calls are contained behind web/server observability helpers.
- Those helpers expose a typed extension surface for 7B request and note
  correlation attributes.
- The existing note, save, draft, recovery, and routing behavior remains intact.
