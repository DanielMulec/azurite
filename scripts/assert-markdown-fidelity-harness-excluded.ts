import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const productOutput = path.resolve("apps/web/dist");
const expectedIndex = path.join(productOutput, "index.html");
const forbiddenTokens = [
  "__azuriteMarkdownFidelityQa",
  "Reject editor creation",
  "Markdown fidelity lifecycle QA",
  "markdown-fidelity-qa",
] as const;

if (!existsSync(expectedIndex)) {
  throw new Error(
    "Ordinary web output is missing. Run the normal product build before the harness-exclusion assertion.",
  );
}

const outputFiles = listFiles(productOutput);
for (const filePath of outputFiles) {
  assertFileNameIsProductOnly(filePath);
  assertFileContentIsProductOnly(filePath);
}

console.info(
  `Verified ${String(outputFiles.length)} ordinary product files contain no Markdown fidelity harness entry, marker, or fault controls.`,
);

function listFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath).flatMap((entryName) => {
    const entryPath = path.join(directoryPath, entryName);
    return statSync(entryPath).isDirectory()
      ? listFiles(entryPath)
      : [entryPath];
  });
}

function assertFileNameIsProductOnly(filePath: string): void {
  const relativePath = path.relative(productOutput, filePath);
  if (relativePath.includes("markdown-fidelity")) {
    throw new Error(`Harness file leaked into product output: ${relativePath}`);
  }
}

function assertFileContentIsProductOnly(filePath: string): void {
  const content = readFileSync(filePath);
  if (content.includes(0)) {
    return;
  }
  const text = content.toString("utf8");
  const leakedToken = forbiddenTokens.find((token) => text.includes(token));
  if (leakedToken !== undefined) {
    throw new Error(
      `Harness token ${JSON.stringify(leakedToken)} leaked into ${path.relative(productOutput, filePath)}.`,
    );
  }
}
