# Runtime Messages

## Purpose

Runtime messages are user-visible or operator-visible text emitted by the local
server. They should stay intentional because they shape the product's feel and
make local debugging easier.

## Current Server Lifecycle Messages

| Message                                          | When it appears                                       | Notes                                                   |
| ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------- |
| `Shutting down local server.`                    | The process receives `SIGINT` or `SIGTERM`.           | Includes the signal in structured log metadata.         |
| `Azurite vein sealed. Server shut down cleanly.` | Fastify closes successfully during graceful shutdown. | This is intentional product tone, not placeholder text. |
| `Failed to shut down local server.`              | Fastify fails during graceful shutdown.               | Includes error and signal metadata in server logs.      |

## Maintenance Rules

- Keep runtime messages in English unless a task explicitly asks otherwise.
- Treat distinctive product-tone messages as intentional once documented here.
- Promote repeated runtime messages into shared constants only when more than
  one module needs the same text.
- Keep sensitive filesystem details in structured logs only when needed for
  local debugging.
