import { fileURLToPath } from "node:url";

/** Root local environment file used by both Azurite runtimes in development. */
export const rootLocalEnvironmentPath = fileURLToPath(
  new URL("../../../../.env.local", import.meta.url),
);

type EnvironmentFileLoader = (path: string) => void;

/** Loads the optional root `.env.local` without making it a startup requirement. */
export function loadRootLocalEnvironment(
  loadEnvironmentFile: EnvironmentFileLoader = (path) => {
    process.loadEnvFile(path);
  },
): boolean {
  try {
    loadEnvironmentFile(rootLocalEnvironmentPath);
    return true;
  } catch (error) {
    return handleEnvironmentLoadError(error);
  }
}

function handleEnvironmentLoadError(error: unknown): false {
  if (isMissingFileError(error)) {
    return false;
  }

  throw error;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { readonly code?: unknown }).code === "ENOENT"
  );
}
