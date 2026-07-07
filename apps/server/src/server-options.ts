/** Options that affect local server behavior outside individual route handlers. */
export type ServerOptions = {
  readonly workspacePath?: string;
};

/** Reads server options from environment variables used by the local process. */
export function readServerOptionsFromEnvironment(): ServerOptions {
  return readServerOptions(process.env);
}

function readServerOptions(environment: NodeJS.ProcessEnv): ServerOptions {
  const workspacePath = environment.AZURITE_WORKSPACE_PATH;

  if (workspacePath === undefined) {
    return {};
  }

  if (workspacePath.length === 0) {
    return {};
  }

  return { workspacePath };
}
