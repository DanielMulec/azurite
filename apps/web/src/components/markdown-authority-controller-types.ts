import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";

/** Dependencies supplied by one exact React-owned editor session. */
export type AuthorityControllerInput = {
  readonly initialDisposition: DraftDisposition;
  readonly initialMarkdown: string;
  readonly initialMode: EditorMode;
  readonly initialRevision: number;
  readonly onModeChange: (mode: EditorMode) => void;
  readonly publish: (command: PublicationCommand) => PublicationResult;
  readonly readProjection: () => string;
  readonly replaceProjection: (markdown: string) => void;
  readonly sessionKey: string;
};

/** Explicit lifecycle for the one Crepe instance owned by an editor session. */
export type EditorLifecycle = "creating" | "ready" | "failed" | "destroyed";

/** Observable local state rendered by the editor component. */
export type MarkdownAuthorityState = {
  readonly editorError: string | undefined;
  readonly hasPublicationRetry: boolean;
  readonly lifecycle: EditorLifecycle;
  readonly mode: EditorMode;
  readonly sourceMarkdown: string;
};

/** Result of classifying one source or WYSIWYG value. */
export type AcceptedChangeResult =
  | {
      readonly markdown: string;
      readonly publication: PublicationResult;
      readonly status: "processed";
    }
  | {
      readonly reason: "inactive_mode" | "lifecycle" | "synchronization";
      readonly status: "ignored";
    };
