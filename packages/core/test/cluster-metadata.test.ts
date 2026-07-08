import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  clusterMetadataDirectoryName,
  clusterMetadataFileName,
  readOrCreateClusterIdentity,
} from "../src/index.js";

import { withTemporaryWorkspace } from "./temporary-workspace.js";

const firstClusterId = "019f42a6-cb35-72d8-8a96-b197f53c1252";
const secondClusterId = "019f42a6-d213-77ec-91f1-ed50f6769735";

describe("readOrCreateClusterIdentity", () => {
  it("creates missing cluster metadata without storing workspace paths", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const identity = await readOrCreateClusterIdentity(workspacePath, {
        generateClusterId: () => firstClusterId,
        now: () => new Date("2026-07-08T10:00:00.000Z"),
      });

      expect(identity).toEqual({
        clusterId: firstClusterId,
        status: "ready",
      });
      const metadataText = await readFile(
        getMetadataPath(workspacePath),
        "utf8",
      );
      expect(JSON.parse(metadataText)).toEqual({
        clusterId: firstClusterId,
        createdAt: "2026-07-08T10:00:00.000Z",
        schemaVersion: 1,
      });
      expect(metadataText).not.toContain(workspacePath);
    });
  });

  it("reuses existing cluster metadata", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await readOrCreateClusterIdentity(workspacePath, {
        generateClusterId: () => firstClusterId,
      });

      await expect(
        readOrCreateClusterIdentity(workspacePath, {
          generateClusterId: () => secondClusterId,
        }),
      ).resolves.toEqual({
        clusterId: firstClusterId,
        status: "ready",
      });
    });
  });
});

describe("readOrCreateClusterIdentity durability", () => {
  it("is race-safe when metadata is created concurrently", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      let nextIdIndex = 0;
      const generatedIds = [
        firstClusterId,
        secondClusterId,
        "019f42a6-d8e9-75a8-a33d-456e404c55b0",
      ];

      const identities = await Promise.all(
        Array.from({ length: 6 }, () =>
          readOrCreateClusterIdentity(workspacePath, {
            generateClusterId: () =>
              generatedIds[nextIdIndex++] ?? firstClusterId,
          }),
        ),
      );

      const clusterIds = identities.map((identity) =>
        identity.status === "ready" ? identity.clusterId : identity.reason,
      );
      expect(new Set(clusterIds).size).toBe(1);
      expect(generatedIds).toContain(clusterIds[0]);
      const metadata = JSON.parse(
        await readFile(getMetadataPath(workspacePath), "utf8"),
      ) as { readonly clusterId: string };
      expect(metadata.clusterId).toBe(clusterIds[0]);
    });
  });

  it("keeps the same identity after a cluster folder is moved", async () => {
    await withTemporaryWorkspace(async ({ rootPath, workspacePath }) => {
      await readOrCreateClusterIdentity(workspacePath, {
        generateClusterId: () => firstClusterId,
      });
      const movedWorkspacePath = path.join(rootPath, "moved-workspace");
      await rename(workspacePath, movedWorkspacePath);

      await expect(
        readOrCreateClusterIdentity(movedWorkspacePath, {
          generateClusterId: () => secondClusterId,
        }),
      ).resolves.toEqual({
        clusterId: firstClusterId,
        status: "ready",
      });
    });
  });
});

describe("readOrCreateClusterIdentity degraded states", () => {
  it("reports malformed metadata without overwriting it", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      const metadataDirectory = path.join(
        workspacePath,
        clusterMetadataDirectoryName,
      );
      await mkdir(metadataDirectory);
      await writeFile(getMetadataPath(workspacePath), "not json", "utf8");

      await expect(readOrCreateClusterIdentity(workspacePath)).resolves.toEqual(
        {
          reason: "metadata_invalid",
          status: "unavailable",
        },
      );
      await expect(
        readFile(getMetadataPath(workspacePath), "utf8"),
      ).resolves.toBe("not json");
    });
  });

  it("reports unwritable metadata without blocking normal workspace use", async () => {
    await withTemporaryWorkspace(async ({ workspacePath }) => {
      await writeFile(
        path.join(workspacePath, clusterMetadataDirectoryName),
        "not a directory",
        "utf8",
      );

      await expect(readOrCreateClusterIdentity(workspacePath)).resolves.toEqual(
        {
          reason: "metadata_unwritable",
          status: "unavailable",
        },
      );
    });
  });
});

function getMetadataPath(workspacePath: string): string {
  return path.join(
    workspacePath,
    clusterMetadataDirectoryName,
    clusterMetadataFileName,
  );
}
