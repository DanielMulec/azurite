import { createServer } from "./app.js";

const defaultHost = "127.0.0.1";
const defaultPort = 3000;

const host = process.env.HOST ?? defaultHost;
const port = Number.parseInt(process.env.PORT ?? String(defaultPort), 10);

const server = createServer();

await server.listen({ host, port });
