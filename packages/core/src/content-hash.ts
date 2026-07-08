import { createHash } from "node:crypto";

/** Creates a stable version fingerprint for markdown content. */
export function createContentHash(markdown: string): string {
  return `sha256:${createSha256HexDigest(markdown)}`;
}

function createSha256HexDigest(markdown: string): string {
  return createHash("sha256").update(markdown, "utf8").digest("hex");
}
