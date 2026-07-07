import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { renderMarkdownToSafeHtml } from "../markdown-renderer.js";

type RenderState =
  | { readonly status: "error" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly html: string };

type SanitizedMarkdownProps = {
  readonly markdown: string;
};

/** Renders markdown that has passed through Azurite's approved sanitizer. */
export function SanitizedMarkdown({
  markdown,
}: SanitizedMarkdownProps): ReactElement {
  const [renderState, setRenderState] = useState<RenderState>({
    status: "loading",
  });

  useEffect(() => renderMarkdown(markdown, setRenderState), [markdown]);

  if (renderState.status === "error") {
    return (
      <p className="text-sm text-[var(--azurite-muted)]">
        This note could not be rendered safely.
      </p>
    );
  }

  if (renderState.status === "loading") {
    return <p className="text-sm text-[var(--azurite-muted)]">Rendering...</p>;
  }

  return (
    <div
      className="prose prose-slate max-w-none prose-a:text-[var(--azurite-link)] prose-pre:bg-[var(--azurite-code-surface)]"
      dangerouslySetInnerHTML={{ __html: renderState.html }}
    />
  );
}

function renderMarkdown(
  markdown: string,
  setRenderState: (state: RenderState) => void,
): () => void {
  let isActive = true;
  setRenderState({ status: "loading" });

  void renderMarkdownToSafeHtml(markdown).then(
    (html) => {
      setRenderedHtml(html, isActive, setRenderState);
    },
    () => {
      setRenderError(isActive, setRenderState);
    },
  );

  return () => {
    isActive = false;
  };
}

function setRenderedHtml(
  html: string,
  isActive: boolean,
  setRenderState: (state: RenderState) => void,
): void {
  if (!isActive) {
    return;
  }

  setRenderState({ html, status: "ready" });
}

function setRenderError(
  isActive: boolean,
  setRenderState: (state: RenderState) => void,
): void {
  if (!isActive) {
    return;
  }

  setRenderState({ status: "error" });
}
