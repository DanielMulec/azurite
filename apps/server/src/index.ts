import { createServer } from "./app.js";
import { registerGracefulShutdown } from "./server-lifecycle.js";

const defaultHost = "127.0.0.1";
const defaultPort = 3000;

const host = process.env.HOST ?? defaultHost;
const port = Number.parseInt(process.env.PORT ?? String(defaultPort), 10);

const server = createServer();
registerGracefulShutdown(server);

await server.listen({ host, port });
