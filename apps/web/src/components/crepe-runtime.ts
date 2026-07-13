import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/kit/utils";

/** Public Crepe operations used after the instance has become ready. */
export type CrepeRuntime = {
  readonly create: () => Promise<void>;
  readonly destroy: () => Promise<void>;
  readonly getMarkdown: () => string;
  readonly replaceMarkdown: (markdown: string) => void;
};

/** Creation input exposed for component tests and the isolated QA harness. */
export type CrepeRuntimeFactoryInput = {
  readonly initialMarkdown: string;
  readonly onMarkdownUpdated: (markdown: string) => void;
  readonly root: HTMLDivElement;
};

/** Injectable factory at the real editor lifecycle boundary. */
export type CrepeRuntimeFactory = (
  input: CrepeRuntimeFactoryInput,
) => CrepeRuntime;

/** Creates the production runtime using only Crepe's supported public API. */
export const createCrepeRuntime: CrepeRuntimeFactory = ({
  initialMarkdown,
  onMarkdownUpdated,
  root,
}) => {
  root.replaceChildren();
  const crepe = new Crepe({ defaultValue: initialMarkdown, root });
  crepe.on((listener) => {
    listener.markdownUpdated((_context, markdown) => {
      onMarkdownUpdated(markdown);
    });
  });
  return {
    create: async () => {
      await crepe.create();
    },
    destroy: async () => {
      await crepe.destroy();
    },
    getMarkdown: () => crepe.getMarkdown(),
    replaceMarkdown: (markdown) => {
      crepe.editor.action(replaceAll(markdown, true));
    },
  };
};
