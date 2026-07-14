import { readFileSync } from "node:fs";

/**
 * Counts the physical lines in a text file without inventing an extra line for
 * a final newline character.
 */
export function countPhysicalLines(filePath: string): number {
  const text = readFileSync(filePath, "utf8");

  if (text.length === 0) {
    return 0;
  }

  const newlineCount = Array.from(text.matchAll(/\r\n|\r|\n/g)).length;
  const missingFinalLine = text.endsWith("\n") || text.endsWith("\r") ? 0 : 1;

  return newlineCount + missingFinalLine;
}
