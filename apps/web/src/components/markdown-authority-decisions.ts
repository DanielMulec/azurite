import type {
  AuthorityResolution,
  ChangeOrigin,
} from "../domain/markdown-authority-types.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { EditorLifecycle } from "./markdown-authority-controller-types.js";

/** Exact source and matching rich-editor serialization at synchronization. */
export type AuthorityCheckpoint = {
  readonly exactAuthority: string;
  readonly projection: string;
};

/** Visible change retained locally until publication is acknowledged. */
export type AuthorityRetryCandidate = {
  readonly markdown: string;
  readonly origin: ChangeOrigin;
  readonly resolution: AuthorityResolution;
};

/** Returns whether readiness still represents the unedited initial document. */
export function shouldInstallCreationCheckpoint(input: {
  readonly acknowledgedAuthority: string;
  readonly initialMarkdown: string;
  readonly mode: EditorMode;
}): boolean {
  return (
    input.mode === "wysiwyg" &&
    input.acknowledgedAuthority === input.initialMarkdown
  );
}

/** Classifies whether a Milkdown listener may publish into the current session. */
export function getWysiwygIgnoreReason(input: {
  readonly frozen: boolean;
  readonly isPublishing: boolean;
  readonly isSynchronizing: boolean;
  readonly lifecycle: EditorLifecycle;
  readonly mode: EditorMode;
}): "inactive_mode" | "lifecycle" | "synchronization" | undefined {
  if (input.lifecycle !== "ready") {
    return "lifecycle";
  }
  return getActiveWysiwygIgnoreReason(input);
}

function getActiveWysiwygIgnoreReason(input: {
  readonly frozen: boolean;
  readonly isPublishing: boolean;
  readonly isSynchronizing: boolean;
  readonly mode: EditorMode;
}): "inactive_mode" | "synchronization" | undefined {
  if (input.mode !== "wysiwyg") {
    return "inactive_mode";
  }
  if (input.frozen) {
    return "inactive_mode";
  }
  return getSynchronizationIgnoreReason(input);
}

function getSynchronizationIgnoreReason(input: {
  readonly isPublishing: boolean;
  readonly isSynchronizing: boolean;
}): "synchronization" | undefined {
  return input.isSynchronizing || input.isPublishing
    ? "synchronization"
    : undefined;
}

/** Returns whether a controller can no longer accept a visible candidate. */
export function isControllerUnavailable(
  frozen: boolean,
  lifecycle: EditorLifecycle,
): boolean {
  return frozen || lifecycle === "destroyed";
}

/** Returns whether a live projection needs no publication work. */
export function isCommitProjectionCurrent(input: {
  readonly acknowledgedProjection: string | undefined;
  readonly hasRetry: boolean;
  readonly projection: string;
}): boolean {
  return (
    input.projection === input.acknowledgedProjection && !input.hasRetry
  );
}

/** Restores exact checkpoint bytes or accepts the current serialization. */
export function resolveProjectionCandidate(
  markdown: string,
  checkpoint: AuthorityCheckpoint | undefined,
): AuthorityRetryCandidate {
  return checkpoint !== undefined && markdown === checkpoint.projection
    ? {
        markdown: checkpoint.exactAuthority,
        origin: "wysiwyg_document",
        resolution: "checkpoint_restore",
      }
    : {
        markdown,
        origin: "wysiwyg_document",
        resolution: "serialized_projection",
      };
}

/** Derives the acknowledged rich projection after a successful publication. */
export function getAcceptedProjection(
  candidate: AuthorityRetryCandidate,
  checkpoint: AuthorityCheckpoint | undefined,
): string | undefined {
  if (candidate.origin !== "wysiwyg_document") {
    return undefined;
  }
  return candidate.resolution === "checkpoint_restore"
    ? checkpoint?.projection
    : candidate.markdown;
}
