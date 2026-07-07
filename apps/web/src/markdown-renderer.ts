import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

/** Converts untrusted markdown into sanitized HTML for the read-only viewer. */
export async function renderMarkdownToSafeHtml(
  markdown: string,
): Promise<string> {
  const processedFile = await markdownProcessor.process(markdown);

  return String(processedFile);
}
