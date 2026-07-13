import type {
  AuthorityResolution,
  ChangeOrigin,
  CommitCause,
  CommitResult,
  PublicationResult,
  PublicationTrigger,
} from "../domain/markdown-authority-types.js";
import type { EditorMode } from "../persistence/draft-records.js";
import type { DraftDisposition } from "../persistence/draft-workflow-types.js";
import type {
  AcceptedChangeResult,
  EditorLifecycle,
} from "./markdown-authority-controller-types.js";
import {
  createCommitFailure,
  createCommitNoChange,
  createRetryReverted,
} from "./markdown-authority-results.js";

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

/** Creates the initial checkpoint only for the unchanged rich document. */
export function createCreationCheckpoint(
  input: {
    readonly acknowledgedAuthority: string;
    readonly initialMarkdown: string;
    readonly mode: EditorMode;
  },
  projection: string,
): AuthorityCheckpoint | undefined {
  return shouldInstallCreationCheckpoint(input)
    ? { exactAuthority: input.acknowledgedAuthority, projection }
    : undefined;
}

/** Returns the projection stored by a checkpoint without changing authority. */
export function getCheckpointProjection(
  checkpoint: AuthorityCheckpoint | undefined,
): string | undefined {
  return checkpoint?.projection;
}

/** Resolves commits that need no live Crepe projection read. */
export function getImmediateCommitResult(input: {
  readonly cause: CommitCause;
  readonly lifecycle: EditorLifecycle;
  readonly mode: EditorMode;
  readonly revision: number;
  readonly sessionKey: string;
}): CommitResult | undefined {
  if (input.lifecycle === "destroyed") {
    return createCommitFailure(input.cause, "stale_session", input.sessionKey);
  }
  return getInactiveCommitResult(input);
}

function getInactiveCommitResult(input: {
  readonly cause: CommitCause;
  readonly lifecycle: EditorLifecycle;
  readonly mode: EditorMode;
  readonly revision: number;
  readonly sessionKey: string;
}): CommitResult | undefined {
  if (input.mode === "markdown") {
    return createControllerCommitNoChange(input, "source_authority_current");
  }
  if (input.lifecycle !== "ready") {
    return createControllerCommitNoChange(input, "source_authority_current");
  }
  return undefined;
}

/** Creates a no-op commit from the controller's current exact-session state. */
export function createControllerCommitNoChange(
  input: {
    readonly cause: CommitCause;
    readonly revision: number;
    readonly sessionKey: string;
  },
  reason: "projection_unchanged" | "source_authority_current",
): CommitResult {
  return createCommitNoChange({ ...input, reason });
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

/** Derives the acknowledged rich projection after a successful publication. */
export function getAcceptedProjection(
  candidate: AuthorityRetryCandidate,
  checkpoint: AuthorityCheckpoint | undefined,
): string | undefined {
  if (candidate.origin !== "wysiwyg_document") {
    return undefined;
  }
  if (candidate.resolution === "checkpoint_restore") {
    return getCheckpointProjection(checkpoint);
  }
  return candidate.markdown;
}

/** Creates the typed no-op when visible content cancels a rejected candidate. */
export function createRetryReversion(input: {
  readonly acknowledgedAuthority: string;
  readonly candidate: AuthorityRetryCandidate;
  readonly disposition: DraftDisposition;
  readonly retry: AuthorityRetryCandidate | undefined;
  readonly revision: number;
  readonly sessionKey: string;
  readonly trigger: PublicationTrigger;
}): AcceptedChangeResult | undefined {
  if (input.candidate.markdown !== input.acknowledgedAuthority) {
    return undefined;
  }
  if (input.retry === undefined) {
    return undefined;
  }
  return {
    markdown: input.candidate.markdown,
    publication: createRetryReverted({
      disposition: input.disposition,
      origin: input.candidate.origin,
      revision: input.revision,
      sessionKey: input.sessionKey,
      trigger: input.trigger,
    }),
    status: "processed",
  };
}

/** Product fields adopted after a non-rejected authority publication. */
export type AcceptedAuthorityPatch = {
  readonly authority: string;
  readonly disposition: DraftDisposition;
  readonly projection: string | undefined;
  readonly revision: number;
};

/** Derives controller authority fields from an acknowledged or no-op result. */
export function getAcceptedAuthorityPatch(
  candidate: AuthorityRetryCandidate,
  publication: Exclude<PublicationResult, { readonly status: "rejected" }>,
  checkpoint: AuthorityCheckpoint | undefined,
): AcceptedAuthorityPatch {
  return {
    authority: candidate.markdown,
    disposition: publication.disposition,
    projection: getAcceptedProjection(candidate, checkpoint),
    revision: publication.revision,
  };
}
