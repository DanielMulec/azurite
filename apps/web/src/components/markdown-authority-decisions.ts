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

/** Visible change retained locally until publication is accepted. */
export type AuthorityRetryCandidate = {
  readonly markdown: string;
  readonly origin: ChangeOrigin;
  readonly resolution: AuthorityResolution;
};

/** Creates the exact source-input candidate before store publication. */
export function createSourceCandidate(
  markdown: string,
): AuthorityRetryCandidate {
  return { markdown, origin: "source_input", resolution: "exact_input" };
}

/** Safe result of reading a live Crepe projection through its public API. */
export type ProjectionReadResult<Failure> =
  | { readonly projection: string; readonly status: "read" }
  | { readonly result: Failure; readonly status: "failed" };

/** Reads the live projection while letting the caller type the failure result. */
export function readAuthorityProjection<Failure>(
  readProjection: () => string,
  onFailure: () => Failure,
): ProjectionReadResult<Failure> {
  try {
    return { projection: readProjection(), status: "read" };
  } catch {
    return { result: onFailure(), status: "failed" };
  }
}

/** Creates the initial checkpoint only while Crepe still projects its source. */
export function createCreationCheckpoint(
  input: {
    readonly creationMarkdown: string;
    readonly currentMarkdown: string;
    readonly mode: EditorMode;
  },
  projection: string,
): AuthorityCheckpoint | undefined {
  return input.mode === "wysiwyg" &&
    input.currentMarkdown === input.creationMarkdown
    ? { exactAuthority: input.currentMarkdown, projection }
    : undefined;
}

/** Returns the projection stored by a checkpoint without changing authority. */
export function getCheckpointProjection(
  checkpoint: AuthorityCheckpoint | undefined,
): string | undefined {
  return checkpoint?.projection;
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
  if (input.mode !== "wysiwyg") {
    return "inactive_mode";
  }
  if (input.frozen) {
    return "inactive_mode";
  }
  if (hasSynchronizationGuard(input)) {
    return "synchronization";
  }
  return undefined;
}

function hasSynchronizationGuard(input: {
  readonly isPublishing: boolean;
  readonly isSynchronizing: boolean;
}): boolean {
  return input.isSynchronizing || input.isPublishing;
}

/** Returns whether a live projection needs no publication work. */
export function isCommitProjectionCurrent(input: {
  readonly acknowledgedProjection: string | undefined;
  readonly hasRetry: boolean;
  readonly projection: string;
}): boolean {
  return input.projection === input.acknowledgedProjection && !input.hasRetry;
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

/** Derives the acknowledged rich projection after an accepted publication. */
export function getAcceptedProjection(
  candidate: AuthorityRetryCandidate,
  checkpoint: AuthorityCheckpoint | undefined,
): string | undefined {
  if (candidate.origin !== "wysiwyg_document") {
    return undefined;
  }
  return candidate.resolution === "checkpoint_restore"
    ? getCheckpointProjection(checkpoint)
    : candidate.markdown;
}
