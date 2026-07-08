import type {
  ClusterIdentity,
  ClusterIdentityUnavailableReason,
} from "@azurite/shared";
import { clusterIdentitySchema } from "@azurite/shared";
import { link, mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveWorkspaceRoot } from "./workspace-root.js";

/** Azurite-owned metadata directory name inside a cluster. */
export const clusterMetadataDirectoryName = ".azurite";

/** Cluster identity metadata file name inside `.azurite/`. */
export const clusterMetadataFileName = "cluster.json";

type ClusterMetadata = {
  readonly clusterId: string;
  readonly createdAt: string;
  readonly schemaVersion: 1;
};

type ClusterMetadataReadResult =
  | { readonly status: "invalid" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly metadata: ClusterMetadata }
  | { readonly status: "unavailable" };

type ClusterMetadataOptions = {
  readonly generateClusterId?: () => string;
  readonly now?: () => Date;
};

/** Reads or creates the durable cluster identity stored in `.azurite/`. */
export async function readOrCreateClusterIdentity(
  workspacePath: string,
  options: ClusterMetadataOptions = {},
): Promise<ClusterIdentity> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath);
  const metadataPath = getClusterMetadataPath(workspaceRoot.absolutePath);
  const existingMetadata = await readClusterMetadata(metadataPath);
  const existingIdentity = toExistingClusterIdentity(existingMetadata);

  if (existingIdentity !== undefined) {
    return existingIdentity;
  }

  return createClusterMetadata(workspaceRoot.absolutePath, options);
}

function getClusterMetadataPath(workspaceRootPath: string): string {
  return path.join(
    workspaceRootPath,
    clusterMetadataDirectoryName,
    clusterMetadataFileName,
  );
}

async function readClusterMetadata(
  metadataPath: string,
): Promise<ClusterMetadataReadResult> {
  try {
    return parseClusterMetadata(await readFile(metadataPath, "utf8"));
  } catch (error) {
    if (isMetadataPathAbsentError(error)) {
      return { status: "missing" };
    }

    return { status: "unavailable" };
  }
}

function parseClusterMetadata(json: string): ClusterMetadataReadResult {
  try {
    const parsedValue = JSON.parse(json) as unknown;

    if (isClusterMetadata(parsedValue)) {
      return { metadata: parsedValue, status: "ready" };
    }

    return { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

function isClusterMetadata(value: unknown): value is ClusterMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return clusterMetadataChecks.every((check) => check(value));
}

function isValidClusterId(clusterId: string): boolean {
  return clusterIdentitySchema.safeParse({
    clusterId,
    status: "ready",
  }).success;
}

function isIsoDateTime(value: string): boolean {
  const time = Date.parse(value);

  return !Number.isNaN(time) && value.endsWith("Z");
}

async function createClusterMetadata(
  workspaceRootPath: string,
  options: ClusterMetadataOptions,
): Promise<ClusterIdentity> {
  const metadataDirectoryPath = path.join(
    workspaceRootPath,
    clusterMetadataDirectoryName,
  );
  const metadataPath = getClusterMetadataPath(workspaceRootPath);
  const metadata = createClusterMetadataRecord(options);

  try {
    await mkdir(metadataDirectoryPath, { recursive: true });
    return await installNewClusterMetadata(metadataPath, metadata);
  } catch {
    return unavailableClusterIdentity("metadata_unwritable");
  }
}

function createClusterMetadataRecord(
  options: ClusterMetadataOptions,
): ClusterMetadata {
  return {
    clusterId: createClusterId(options),
    createdAt: createMetadataTimestamp(options),
    schemaVersion: 1,
  };
}

async function installNewClusterMetadata(
  metadataPath: string,
  metadata: ClusterMetadata,
): Promise<ClusterIdentity> {
  const temporaryPath = createTemporaryMetadataPath(metadataPath);

  try {
    await writeMetadataFile(temporaryPath, metadata);
    await link(temporaryPath, metadataPath);
    return toReadyClusterIdentity(metadata.clusterId);
  } catch (error) {
    if (isFileAlreadyExistsError(error)) {
      return await readWinningClusterIdentity(metadataPath);
    }

    throw error;
  } finally {
    await rm(temporaryPath, { force: true }).catch(ignoreCleanupError);
  }
}

function createTemporaryMetadataPath(metadataPath: string): string {
  return path.join(
    path.dirname(metadataPath),
    `.cluster-${String(process.pid)}-${randomUUID()}.tmp`,
  );
}

async function writeMetadataFile(
  filePath: string,
  metadata: ClusterMetadata,
): Promise<void> {
  const fileHandle = await open(filePath, "wx");

  try {
    await fileHandle.writeFile(
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
    await fileHandle.sync();
  } finally {
    await fileHandle.close();
  }
}

async function readWinningClusterIdentity(
  metadataPath: string,
): Promise<ClusterIdentity> {
  const metadata = await readClusterMetadata(metadataPath);

  if (metadata.status === "ready") {
    return toReadyClusterIdentity(metadata.metadata.clusterId);
  }

  if (metadata.status === "invalid") {
    return unavailableClusterIdentity("metadata_invalid");
  }

  return unavailableClusterIdentity("metadata_unavailable");
}

function toReadyClusterIdentity(clusterId: string): ClusterIdentity {
  return { clusterId, status: "ready" };
}

function unavailableClusterIdentity(
  reason: ClusterIdentityUnavailableReason,
): ClusterIdentity {
  return { reason, status: "unavailable" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMetadataPathAbsentError(error: unknown): boolean {
  return isNodeError(error) && ["ENOENT", "ENOTDIR"].includes(error.code ?? "");
}

function isFileAlreadyExistsError(error: unknown): boolean {
  return isNodeError(error) && error.code === "EEXIST";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function ignoreCleanupError(): void {}

const clusterMetadataChecks: readonly ((
  value: Record<string, unknown>,
) => boolean)[] = [
  (value) => value.schemaVersion === 1,
  (value) => typeof value.clusterId === "string",
  (value) =>
    typeof value.clusterId === "string" && isValidClusterId(value.clusterId),
  (value) => typeof value.createdAt === "string",
  (value) =>
    typeof value.createdAt === "string" && isIsoDateTime(value.createdAt),
];

const readUnavailableReasons = new Map<
  ClusterMetadataReadResult["status"],
  ClusterIdentityUnavailableReason
>([
  ["invalid", "metadata_invalid"],
  ["unavailable", "metadata_unavailable"],
]);

function toExistingClusterIdentity(
  result: ClusterMetadataReadResult,
): ClusterIdentity | undefined {
  if (result.status === "ready") {
    return toReadyClusterIdentity(result.metadata.clusterId);
  }

  return toUnavailableReadIdentity(result.status);
}

function toUnavailableReadIdentity(
  status: ClusterMetadataReadResult["status"],
): ClusterIdentity | undefined {
  const reason = readUnavailableReasons.get(status);

  return reason === undefined ? undefined : unavailableClusterIdentity(reason);
}

function createClusterId(options: ClusterMetadataOptions): string {
  return options.generateClusterId === undefined
    ? randomUUID()
    : options.generateClusterId();
}

function createMetadataTimestamp(options: ClusterMetadataOptions): string {
  return options.now === undefined
    ? new Date().toISOString()
    : options.now().toISOString();
}
