import type {
  PublicationCommand,
  PublicationResult,
} from "../domain/markdown-authority-types.js";
import type { EditorSession } from "../state/note-browser-types.js";

/** Dependencies supplied by one exact React-owned editor session. */
export type AuthorityControllerInput = {
  readonly isSessionFrozen: (sessionKey: string) => boolean;
  readonly onModeChange: (mode: EditorSession["editorMode"]) => void;
  readonly publish: (command: PublicationCommand) => PublicationResult;
  readonly readProjection: () => string;
  readonly readSession: (sessionKey: string) => EditorSession | undefined;
  readonly replaceProjection: (markdown: string) => void;
  readonly sessionKey: string;
};

/** Explicit lifecycle for the one Crepe instance owned by an editor session. */
export type EditorLifecycle = "creating" | "ready" | "failed";

/** Observable local state rendered by the editor component. */
export type MarkdownAuthorityState = {
  readonly editorError: string | undefined;
  readonly hasPublicationRetry: boolean;
  readonly lifecycle: EditorLifecycle;
  readonly rejectedMarkdown: string | undefined;
};

/** Result of classifying one source or WYSIWYG value. */
export type AcceptedChangeResult =
  | PublicationResult
  | {
      readonly reason: "inactive_mode" | "lifecycle" | "synchronization";
      readonly status: "ignored";
    };
