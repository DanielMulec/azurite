# Sentry Debug Runtime

## Purpose

Run Azurite's Daniel-owned local debug observability runtime for the React web
app and Fastify API. This mode delivers errors, structured logs, browser console
warnings/errors, traces, and Session Replay to separate Sentry projects without
making observability product state.

Sentry is optional. When it is not explicitly enabled, Azurite starts and works
without a DSN and the current entrypoints do not import the Sentry browser,
server, or Replay runtime modules.

## Projects

- `azurite-web`: React errors, logs, traces, and Session Replay.
- `azurite-server`: Fastify errors, logs, and traces.

Use each project's current client key from Sentry. Never paste a real DSN into a
committed file, issue, log, or documentation page.

## Configure Root `.env.local`

Copy `.env.example` to the ignored repository-root `.env.local`, then set only
the values needed for the current debug session.

Web variables:

| Variable                                 | Purpose                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `VITE_SENTRY_ENABLED`                    | Must be the literal `true` to permit web startup.  |
| `VITE_SENTRY_DSN`                        | `azurite-web` client key; also required to enable. |
| `VITE_SENTRY_ENVIRONMENT`                | Environment label, normally `local-debug`.         |
| `VITE_SENTRY_RELEASE`                    | Shared local release name for web/server evidence. |
| `VITE_SENTRY_TRACE_SAMPLE_RATE`          | Browser trace sample rate in the inclusive `0..1`. |
| `VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE` | Session Replay sampling in the inclusive `0..1`.   |
| `VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE`   | Error Replay sampling in the inclusive `0..1`.     |
| `VITE_SENTRY_TEST_EVENTS_ENABLED`        | Literal `true` exposes the dev diagnostics panel.  |

Server variables:

| Variable                     | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `SENTRY_ENABLED`             | Must be the literal `true` to permit server startup.  |
| `SENTRY_DSN`                 | `azurite-server` client key; also required to enable. |
| `SENTRY_ENVIRONMENT`         | Environment label, normally `local-debug`.            |
| `SENTRY_RELEASE`             | Shared local release name for web/server evidence.    |
| `SENTRY_TRACE_SAMPLE_RATE`   | Backend trace sample rate in the inclusive `0..1`.    |
| `SENTRY_TEST_EVENTS_ENABLED` | Literal `true` registers the dev-only POST route.     |

Invalid sample rates fall back to the local debug default of `1.0`. The example
uses `1.0` for tracing and Replay so an explicitly enabled verification session
produces visible evidence. Lower the values only when full local capture is not
needed.

Future deployed runtimes may provide the same variables through their
environment or secret store. `.env.local` is only the preferred local value
source.

## Enable And Disable

Sentry enables independently per runtime only when its enabled flag is exactly
`true` and its DSN is non-empty. `TRUE`, `1`, a missing flag, or a missing DSN
all remain disabled.

To force a disabled session while an enabled `.env.local` exists, provide
process-level overrides:

```sh
SENTRY_ENABLED=false SENTRY_DSN= SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm --filter @azurite/server dev

VITE_SENTRY_ENABLED=false VITE_SENTRY_DSN= \
VITE_SENTRY_TEST_EVENTS_ENABLED=false \
  /opt/homebrew/bin/pnpm --filter @azurite/web dev
```

Disabled server shutdown keeps the existing `500ms` fallback and does not await
Sentry work.

## Start Local Debug Runtime

Start Fastify on localhost:

```sh
AZURITE_WORKSPACE_PATH=/absolute/path/to/cluster \
  /opt/homebrew/bin/pnpm --filter @azurite/server dev
```

The server script loads `src/sentry-preload.mjs` through `tsx --import` before
the Fastify module graph. The `.mjs` file is the required external-preload
exception to Azurite's TypeScript utility rule. It loads optional root
`.env.local`, returns before `@sentry/node` import when disabled, and initializes
the SDK before Fastify when enabled.

Azurite uses Sentry 10's supported Fastify 5 diagnostics-channel integration.
`setupFastifyErrorHandler` is intentionally not added because the installed SDK
identifies it as the Fastify 3/4 path and warns that it duplicates Fastify 5
error capture.

Start Vite:

```sh
/opt/homebrew/bin/pnpm --filter @azurite/web dev
```

Open the explicit diagnostics URL:

```text
http://127.0.0.1:5173/?note=index.md&azurite-dev=sentry-test
```

The panel appears only in Vite development mode, with the web test-event flag
set to literal `true`, and with the typed URL value
`azurite-dev=sentry-test`. Note navigation and browser history preserve this
value.

## Send Deliberate Test Evidence

The panel exposes two intentional actions:

- **Send web test event** emits a structured log, breadcrumb, span/error
  evidence, and a deliberate browser console warning.
- **Send server test event** sends a traced `POST` through Vite to the local
  Fastify route and reports whether `sentry-trace` and `baggage` reached the
  backend.

The visible Replay marker is:

```text
AZURITE-SENTRY-7A-UNMASKED-REPLAY-MARKER
```

Replay is intentionally uncensored for this explicit debug mode:
`maskAllText=false`, `maskAllInputs=false`, and `blockAllMedia=false`.
Password fields retain the installed SDK's credential protection. The Slice 7A
proof requires the marker to be readable; Slice 7D owns editor-specific Replay
fidelity.

The backend route exists only outside production when its test-event flag is
literal `true`:

```text
POST /__azurite/dev/sentry-test-event
x-azurite-dev-test-event: sentry
```

It does not read, create, save, or delete notes, drafts, cluster metadata, or
filesystem content.

## Verify In Sentry

For `azurite-web`, verify:

1. The deliberate web issue is present with the configured release and
   `local-debug` environment.
2. Logs contain `telemetry.web.test.triggered`,
   `telemetry.runtime.console.captured`, and the deliberate console warning.
3. The linked Replay shows the full marker text.
4. Browser HTTP spans exist for relative `/api/*` requests.

For `azurite-server`, verify:

1. The deliberate backend issue is present for
   `POST /__azurite/dev/sentry-test-event`.
2. Logs contain `telemetry.server.test.triggered` and
   `telemetry.runtime.trace_headers.seen`.
3. Trace Explorer shows the browser HTTP span and Fastify request transaction
   in one trace.

The SDK automatically propagates `sentry-trace` and `baggage` for the relative
same-origin API paths. Vite proxies both headers to `127.0.0.1:3000`, so no
cross-origin CORS configuration is needed for the current architecture.

## Shutdown

On enabled `SIGINT` or `SIGTERM`, Azurite:

1. closes Fastify;
2. performs the initial Sentry flush with a `1000ms` SDK timeout;
3. records the flush result and gives that result a bounded `400ms` follow-up
   flush;
4. keeps a `1500ms` process fallback, longer than both flush budgets together.

A hung flush cannot keep the backend alive indefinitely. Disabled shutdown
closes only Fastify and retains its `500ms` fallback.

## Tailscale Phone Verification

Follow `docs/runbooks/tailscale-phone-access.md`. Keep Fastify on
`127.0.0.1:3000`, bind only Vite to the current Tailscale IPv4 interface, and
use the current `Self.DNSName` as the phone origin.

Open:

```text
http://<magicdns-hostname>:5173/?note=index.md&azurite-dev=sentry-test
```

Then send the web and server test events from the phone and verify:

- the server response reports both trace headers;
- `azurite-web` receives a distinct phone session;
- a distinct phone Replay contains the unmasked marker;
- Fastify remains unreachable directly from the tailnet.

## Credential Containment

Explicit debug mode may capture complete Azurite product data needed for
diagnosis. It must never deliberately capture or commit credentials,
authorization headers, session cookies, API keys, auth tokens, DSNs, passwords,
or secret environment values. Keep `.env.local` ignored and use
`.env.example` placeholders only.
