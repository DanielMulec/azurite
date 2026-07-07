import { markdownNoteFileExtension } from "@azurite/shared";
import { toString } from "mdast-util-to-string";
import type { Heading, RootContent } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";

const markdownParser = unified().use(remarkParse);

/** Extracts the first level-one markdown heading, falling back to the file name. */
export function extractNoteTitle(markdown: string, fileName: string): string {
  const tree = markdownParser.parse(markdown);
  const titleHeading = findFirstLevelOneHeading(tree.children);

  if (titleHeading === undefined) {
    return createFallbackTitle(fileName);
  }

  return titleFromHeadingOrFallback(titleHeading, fileName);
}

function titleFromHeadingOrFallback(
  heading: Heading,
  fileName: string,
): string {
  const title = toString(heading).trim();

  if (title.length === 0) {
    return createFallbackTitle(fileName);
  }

  return title;
}

function findFirstLevelOneHeading(
  children: readonly RootContent[],
): Heading | undefined {
  return children.find(isLevelOneHeading);
}

function isLevelOneHeading(node: RootContent): node is Heading {
  return node.type === "heading" && node.depth === 1;
}

function createFallbackTitle(fileName: string): string {
  return pathlessFileNameWithoutMarkdownExtension(fileName);
}

function pathlessFileNameWithoutMarkdownExtension(fileName: string): string {
  if (!fileName.endsWith(markdownNoteFileExtension)) {
    return fileName;
  }

  return fileName.slice(0, -markdownNoteFileExtension.length);
}
