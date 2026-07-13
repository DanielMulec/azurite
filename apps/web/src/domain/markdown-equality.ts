/** Normalizes only CRLF to LF for Azurite's exact Markdown comparison. */
export function normalizeMarkdownLineEndings(markdown: string): string {
  return markdown.replace(/\r\n/gu, "\n");
}

/** Returns whether two Markdown values differ beyond CRLF/LF representation. */
export function hasMarkdownDifference(
  currentMarkdown: string,
  savedMarkdown: string,
): boolean {
  return (
    normalizeMarkdownLineEndings(currentMarkdown) !==
    normalizeMarkdownLineEndings(savedMarkdown)
  );
}

/** Returns whether two Markdown values are exact after CRLF/LF equivalence. */
export function markdownEquals(left: string, right: string): boolean {
  return !hasMarkdownDifference(left, right);
}
