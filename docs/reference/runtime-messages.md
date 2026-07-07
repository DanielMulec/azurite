# Runtime Messages

## Purpose

Runtime messages are user-visible or operator-visible text emitted by local
Azurite processes. They should stay intentional because they shape the product's
feel and make local debugging easier.

## Current API Server Lifecycle Messages

| Message                                           | When it appears                                       | Notes                                                   |
| ------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `Shutting down local server.`                     | The process receives `SIGINT` or `SIGTERM`.           | Includes the signal in structured log metadata.         |
| `Azurite vein sealed. Backend shut down cleanly.` | Fastify closes successfully during graceful shutdown. | This is intentional product tone, not placeholder text. |
| `Failed to shut down local server.`               | Fastify fails during graceful shutdown.               | Includes error and signal metadata in server logs.      |

## Current Web Dev Server Lifecycle Messages

| Message                                                  | When it appears                           | Notes                                                   |
| -------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `Shutting down local web dev server after SIGINT.`       | The Vite dev process receives `SIGINT`.   | The signal name changes for other shutdown signals.     |
| `Azurite vein sealed. Frontend shut down cleanly.`       | Vite closes successfully during shutdown. | This is intentional product tone, not placeholder text. |
| `Failed to shut down local web dev server after SIGINT.` | Vite fails during shutdown.               | Includes the error object in Vite logger metadata.      |

## Maintenance Rules

- Keep runtime messages in English unless a task explicitly asks otherwise.
- Treat distinctive product-tone messages as intentional once documented here.
- Promote repeated runtime messages into shared constants only when more than
  one module needs the same text.
- Keep sensitive filesystem details in structured logs only when needed for
  local debugging.
