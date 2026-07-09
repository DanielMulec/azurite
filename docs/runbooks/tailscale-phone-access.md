# Tailscale Phone Access

## Purpose

Start Azurite for private phone QA while exposing only the Vite frontend to the
tailnet. Fastify remains local-only and receives browser API traffic through the
Vite proxy.

## Preconditions

- Tailscale is connected on the development Mac and phone.
- The selected cluster is safe for the intended QA workflow.
- `/opt/homebrew/bin/pnpm` uses the repository's Node 26 toolchain.

## Read The Current Tailnet Address

Run:

```sh
tailscale status --self --json
```

Use:

- `Self.DNSName` as the user-facing MagicDNS hostname.
- the first IPv4 value in `TailscaleIPs` as the Vite bind host.

Do not commit either session-specific value and do not present a static
Tailscale IP as the durable phone URL.

## Start The Backend

Keep Fastify on localhost:

```sh
AZURITE_WORKSPACE_PATH=/absolute/path/to/cluster \
  /opt/homebrew/bin/pnpm --filter @azurite/server dev
```

The backend should listen on `127.0.0.1:3000`.

## Start The Frontend

Bind Vite only to the Tailscale IPv4 address and allow the MagicDNS hostname:

```sh
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=<magicdns-hostname> \
  /opt/homebrew/bin/pnpm --filter @azurite/web exec vite \
  --host <tailscale-ipv4> \
  --port 5173
```

Vite 8 rejects an unapproved `Host` header. If the raw Tailscale IP works but
MagicDNS returns `403`, confirm that
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` contains the hostname without protocol
or port.

If Tailscale Serve is enabled, it may proxy the Vite localhost endpoint instead.
Do not use Tailscale Funnel; public exposure is outside Azurite's current
security boundary.

## Open Azurite On The Phone

Use:

```text
http://<magicdns-hostname>:5173/
```

Use this stable origin for IndexedDB and reload-recovery QA. Switching between a
raw IP and MagicDNS creates different browser origins and therefore different
browser storage.

## Long-Running QA Sessions

For a longer session, keep the backend and frontend in a named `tmux` session.
Record the session name in the task handoff so the next operator can inspect or
stop the processes intentionally.

## Verification

- The phone reaches the MagicDNS URL.
- Note-list, read, edit, draft recovery, and manual save requests work through
  the Vite proxy.
- Fastify remains unreachable directly from the tailnet.
- Reloads continue on the same MagicDNS origin.
- Stopping both processes produces the documented clean shutdown behavior.

## Sentry Debug Sessions

When the current QA session also verifies Sentry, enable the root `.env.local`
workflow from `docs/runbooks/sentry-debug.md` before starting either runtime.
Use the diagnostics URL on the same MagicDNS origin:

```text
http://<magicdns-hostname>:5173/?note=index.md&azurite-dev=sentry-test
```

Send both deliberate test events from the phone, confirm the response reports
`sentry-trace=true` and `baggage=true`, and verify a distinct mobile web session
and Replay in `azurite-web`. The Replay marker must remain readable. Fastify
must still listen only on `127.0.0.1:3000`.
