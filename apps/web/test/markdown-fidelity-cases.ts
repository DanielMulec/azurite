/** Shared exact-text cases consumed by every Markdown dirty-state boundary. */
export const markdownEqualityCases = [
  {
    current: "# Same\n",
    equal: true,
    name: "exact text",
    saved: "# Same\n",
  },
  {
    current: "# Windows\r\n\r\nLine\r\n",
    equal: true,
    name: "CRLF and LF only",
    saved: "# Windows\n\nLine\n",
  },
  {
    current: "* item\n",
    equal: false,
    name: "unordered-list marker",
    saved: "- item\n",
  },
  {
    current: "- first\n\n- second\n",
    equal: false,
    name: "loose versus tight list",
    saved: "- first\n- second\n",
  },
  {
    current: "Line  \nNext\n",
    equal: false,
    name: "trailing spaces",
    saved: "Line\nNext\n",
  },
  {
    current: "First\n\n\nSecond\n",
    equal: false,
    name: "deliberate blank line",
    saved: "First\n\nSecond\n",
  },
  {
    current: "# Ending\n",
    equal: false,
    name: "trailing newline",
    saved: "# Ending",
  },
  {
    current: "_emphasis_\n",
    equal: false,
    name: "emphasis marker",
    saved: "*emphasis*\n",
  },
] as const;

/** Programmatic CRLF fixture immune to Git line-ending conversion. */
export const crlfMarkdownFixture = [
  "# CRLF authority",
  "",
  "- first",
  "- second",
  "",
].join("\r\n");
