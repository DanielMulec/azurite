import { isIgnoredWorkspaceDirectoryName } from "@azurite/shared";
import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  resolveCandidatePathInsideWorkspace,
  toWorkspaceRelativePath,
} from "./path-boundary.js";
import type { ResolvedWorkspaceRoot } from "./workspace-root.js";

/** Markdown file found inside a workspace, keeping absolute paths private to core. */
export type DiscoveredMarkdownFile = {
  readonly absolutePath: string;
  readonly fileName: string;
  readonly relativePath: string;
};

/** Recursively discovers markdown files that remain inside the workspace boundary. */
export async function discoverMarkdownFiles(
  workspaceRoot: ResolvedWorkspaceRoot,
): Promise<DiscoveredMarkdownFile[]> {
  const files = await listMarkdownFilesInDirectory(
    workspaceRoot,
    workspaceRoot.absolutePath,
  );

  return files.sort(compareDiscoveredMarkdownFiles);
}

async function listMarkdownFilesInDirectory(
  workspaceRoot: ResolvedWorkspaceRoot,
  directoryPath: string,
): Promise<DiscoveredMarkdownFile[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const discoveredFiles = await Promise.all(
    entries.map((entry) =>
      discoverDirectoryEntry(workspaceRoot, directoryPath, entry),
    ),
  );

  return discoveredFiles.flat();
}

async function discoverDirectoryEntry(
  workspaceRoot: ResolvedWorkspaceRoot,
  directoryPath: string,
  entry: Dirent,
): Promise<DiscoveredMarkdownFile[]> {
  const entryPath = path.join(directoryPath, entry.name);

  if (entry.isDirectory()) {
    return discoverRegularDirectoryEntry(workspaceRoot, entryPath, entry.name);
  }

  if (isDiscoverableFileEntry(entry)) {
    return discoverFileEntry(workspaceRoot, entryPath);
  }

  return [];
}

async function discoverRegularDirectoryEntry(
  workspaceRoot: ResolvedWorkspaceRoot,
  directoryPath: string,
  directoryName: string,
): Promise<DiscoveredMarkdownFile[]> {
  if (isIgnoredWorkspaceDirectoryName(directoryName)) {
    return [];
  }

  return listMarkdownFilesInDirectory(workspaceRoot, directoryPath);
}

async function discoverFileEntry(
  workspaceRoot: ResolvedWorkspaceRoot,
  entryPath: string,
): Promise<DiscoveredMarkdownFile[]> {
  const realFilePath = await resolveMarkdownFileTarget(
    workspaceRoot,
    entryPath,
  );

  if (realFilePath === undefined) {
    return [];
  }

  const relativePath = toWorkspaceRelativePath(workspaceRoot, entryPath);

  if (relativePath === undefined) {
    return [];
  }

  return [createDiscoveredMarkdownFile(entryPath, realFilePath, relativePath)];
}

async function resolveMarkdownFileTarget(
  workspaceRoot: ResolvedWorkspaceRoot,
  entryPath: string,
): Promise<string | undefined> {
  if (!isMarkdownPath(entryPath)) {
    return undefined;
  }

  const realFilePath = await resolveCandidatePathInsideWorkspace(
    workspaceRoot,
    entryPath,
  );

  if (realFilePath === undefined) {
    return undefined;
  }

  return getRegularFilePath(realFilePath);
}

async function getRegularFilePath(
  filePath: string,
): Promise<string | undefined> {
  const fileStats = await stat(filePath);

  if (!fileStats.isFile()) {
    return undefined;
  }

  return filePath;
}

function createDiscoveredMarkdownFile(
  entryPath: string,
  realFilePath: string,
  relativePath: string,
): DiscoveredMarkdownFile {
  return {
    absolutePath: realFilePath,
    fileName: path.basename(entryPath),
    relativePath,
  };
}

function compareDiscoveredMarkdownFiles(
  first: DiscoveredMarkdownFile,
  second: DiscoveredMarkdownFile,
): number {
  return compareText(first.relativePath, second.relativePath);
}

function compareText(first: string, second: string): number {
  if (first < second) {
    return -1;
  }

  if (first > second) {
    return 1;
  }

  return 0;
}

function isDiscoverableFileEntry(entry: Dirent): boolean {
  return entry.isFile() || entry.isSymbolicLink();
}

function isMarkdownPath(filePath: string): boolean {
  return path.extname(filePath) === ".md";
}
