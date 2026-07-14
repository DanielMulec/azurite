import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { countPhysicalLines } from "./count-physical-lines.js";

const approvedPrettierIgnoreEntries = [
  "node_modules/",
  "dist/",
  "coverage/",
  "pnpm-lock.yaml",
] as const;
const maxActiveSliceLines = 500;
const repositoryRoot = process.cwd();

function readPrettierIgnoreEntries(): string[] {
  return readFileSync(path.join(repositoryRoot, ".prettierignore"), "utf8")
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function collectPrettierIgnoreFailures(): string[] {
  const actualEntries = readPrettierIgnoreEntries();
  const hasApprovedEntries =
    actualEntries.length === approvedPrettierIgnoreEntries.length &&
    actualEntries.every(
      (entry, index) => entry === approvedPrettierIgnoreEntries[index],
    );

  if (hasApprovedEntries) {
    return [];
  }

  return [
    `.prettierignore must contain exactly ${JSON.stringify(approvedPrettierIgnoreEntries)}; found ${JSON.stringify(actualEntries)}.`,
  ];
}

function listActiveSliceDocuments(): string[] {
  const activeSliceDirectory = path.join(repositoryRoot, "docs/slices/active");

  return readdirSync(activeSliceDirectory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "README.md",
    )
    .map((entry) => path.join(activeSliceDirectory, entry.name));
}

function collectActiveSliceLineFailures(): string[] {
  return listActiveSliceDocuments()
    .map((filePath) => ({
      filePath,
      lineCount: countPhysicalLines(filePath),
    }))
    .filter((file) => file.lineCount > maxActiveSliceLines)
    .map(
      (file) =>
        `${path.relative(repositoryRoot, file.filePath)} has ${String(file.lineCount)} lines; active slice documents must stay at or below ${String(maxActiveSliceLines)} lines.`,
    );
}

const failures = [
  ...collectPrettierIgnoreFailures(),
  ...collectActiveSliceLineFailures(),
];

if (failures.length > 0) {
  console.error("Engineering governance validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.info(
    "Engineering governance validation passed for formatting exclusions and active slice length.",
  );
}
