import { readdirSync, type Dirent } from "node:fs";
import path from "node:path";
import process from "node:process";

import { countPhysicalLines } from "./count-physical-lines.js";

type CodeFileLineCount = {
  readonly lineCount: number;
  readonly path: string;
};

const maxCodeFileLines = 400;
const codeFileExtensions = new Set<string>([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const ignoredDirectoryNames = new Set<string>([
  ".git",
  ".playwright-mcp",
  "coverage",
  "dist",
  "node_modules",
]);

function isCodeFile(filePath: string): boolean {
  return codeFileExtensions.has(path.extname(filePath));
}

function isIgnoredDirectory(directoryName: string): boolean {
  return ignoredDirectoryNames.has(directoryName);
}

function listCodeFiles(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  return entries.flatMap((entry) =>
    listCodeFilesForEntry(directoryPath, entry),
  );
}

function listCodeFilesForEntry(directoryPath: string, entry: Dirent): string[] {
  const entryPath = path.join(directoryPath, entry.name);

  if (entry.isDirectory()) {
    return listCodeFilesForDirectoryEntry(entryPath, entry.name);
  }

  if (entry.isFile()) {
    return listCodeFilesForFileEntry(entryPath);
  }

  return [];
}

function listCodeFilesForDirectoryEntry(
  directoryPath: string,
  directoryName: string,
): string[] {
  if (isIgnoredDirectory(directoryName)) {
    return [];
  }

  return listCodeFiles(directoryPath);
}

function listCodeFilesForFileEntry(filePath: string): string[] {
  if (!isCodeFile(filePath)) {
    return [];
  }

  return [filePath];
}

function toDisplayPath(repositoryRoot: string, filePath: string): string {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

const repositoryRoot = process.cwd();
const oversizedCodeFiles: CodeFileLineCount[] = listCodeFiles(repositoryRoot)
  .map((filePath) => ({
    lineCount: countPhysicalLines(filePath),
    path: toDisplayPath(repositoryRoot, filePath),
  }))
  .filter((file) => file.lineCount > maxCodeFileLines);

if (oversizedCodeFiles.length > 0) {
  console.error(
    `Code files must stay at or below ${String(maxCodeFileLines)} lines.`,
  );

  for (const file of oversizedCodeFiles) {
    console.error(`${file.path}: ${String(file.lineCount)} lines`);
  }

  process.exitCode = 1;
}
