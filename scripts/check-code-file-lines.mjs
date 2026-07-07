import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const maxCodeFileLines = 400;
const codeFileExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const ignoredDirectoryNames = new Set([
  ".git",
  ".playwright-mcp",
  "coverage",
  "dist",
  "node_modules",
]);

function countPhysicalLines(filePath) {
  const text = readFileSync(filePath, "utf8");

  if (text.length === 0) {
    return 0;
  }

  const newlineMatches = text.match(/\r\n|\r|\n/g);
  const newlineCount = newlineMatches?.length ?? 0;

  if (text.endsWith("\n") || text.endsWith("\r")) {
    return newlineCount;
  }

  return newlineCount + 1;
}

function isCodeFile(filePath) {
  return codeFileExtensions.has(path.extname(filePath));
}

function isIgnoredDirectory(directoryName) {
  return ignoredDirectoryNames.has(directoryName);
}

function listCodeFiles(directoryPath) {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const codeFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory() && !isIgnoredDirectory(entry.name)) {
      codeFiles.push(...listCodeFiles(entryPath));
    }

    if (entry.isFile() && isCodeFile(entryPath)) {
      codeFiles.push(entryPath);
    }
  }

  return codeFiles;
}

function toDisplayPath(repositoryRoot, filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join("/");
}

const repositoryRoot = process.cwd();
const oversizedCodeFiles = listCodeFiles(repositoryRoot)
  .map((filePath) => ({
    lineCount: countPhysicalLines(filePath),
    path: toDisplayPath(repositoryRoot, filePath),
  }))
  .filter((file) => file.lineCount > maxCodeFileLines);

if (oversizedCodeFiles.length > 0) {
  console.error(`Code files must stay at or below ${maxCodeFileLines} lines.`);

  for (const file of oversizedCodeFiles) {
    console.error(`${file.path}: ${file.lineCount} lines`);
  }

  process.exitCode = 1;
}
