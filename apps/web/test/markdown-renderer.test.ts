import { describe, expect, it } from "vitest";

import { renderMarkdownToSafeHtml } from "../src/markdown-renderer.js";

describe("renderMarkdownToSafeHtml", () => {
  it("renders common markdown and GFM structures", async () => {
    const html = await renderMarkdownToSafeHtml(`
# Project

Paragraph with **bold text** and \`code\`.

- [x] Done
- [ ] Next

| Name | Status |
| --- | --- |
| Slice 3 | Planned |

~~old~~
> quoted
`);

    expect(html).toContain("<h1>Project</h1>");
    expect(html).toContain("<strong>bold text</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<table>");
    expect(html).toContain("<del>old</del>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain('type="checkbox"');
  });

  it("removes unsafe HTML and URL protocols", async () => {
    const html = await renderMarkdownToSafeHtml(`
# Safe

<script>alert("xss")</script>
<img src="x" onerror="alert('xss')" />
[bad](javascript:alert('xss'))
`);

    expect(html).toContain("<h1>Safe</h1>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });
});
