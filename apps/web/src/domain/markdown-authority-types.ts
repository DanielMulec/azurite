import type { EditorMode } from "../persistence/draft-records.js";
import type {
  DraftDisposition,
  DraftPersistenceIssue,
} from "../persistence/draft-workflow-types.js";

/** Product origin of one accepted content change. */
export type ChangeOrigin = "source_input" | "wysiwyg_document";

/** How an accepted value became exact Markdown authority. */
export type AuthorityResolution =
  "exact_input" | "serialized_projection" | "checkpoint_restore";

/** Boundary that requested an authority publication. */
export type PublicationTrigger =
  | "direct_input"
  | "listener"
  | "pre_mode_switch"
  | "pre_save"
  | "pre_route_transition"
  | "visibilitychange"
  | "pagehide"
  | "explicit_retry";

/** Exact-session input for one accepted authority publication. */
export type PublicationCommand = {
  readonly markdown: string;
  readonly origin: ChangeOrigin;
  readonly resolution: AuthorityResolution;
  readonly sessionKey: string;
  readonly trigger: PublicationTrigger;
};

/** Typed acknowledgement of one exact-session authority command. */
export type PublicationResult =
  | {
      readonly completion: "normal" | "subscriber_threw_after_apply";
      readonly disposition: DraftDisposition;
      readonly editorMode: EditorMode;
      readonly markdown: string;
      readonly origin: ChangeOrigin;
      readonly persistenceIssue: DraftPersistenceIssue | undefined;
      readonly resolution: AuthorityResolution;
      readonly revision: number;
      readonly sessionKey: string;
      readonly snapshotKey: string;
      readonly stateEffect: "revision_applied";
      readonly status: "acknowledged";
      readonly trigger: PublicationTrigger;
    }
  | {
      readonly disposition: DraftDisposition;
      readonly origin: ChangeOrigin;
      readonly reason: "authority_unchanged" | "retry_reverted";
      readonly revision: number;
      readonly sessionKey: string;
      readonly stateEffect: "none";
      readonly status: "no_change";
      readonly trigger: PublicationTrigger;
    }
  | {
      readonly attemptedMarkdown: string;
      readonly attemptedRevision: number;
      readonly disposition: DraftDisposition;
      readonly origin: ChangeOrigin;
      readonly reason:
        | "closed_epoch"
        | "snapshot_admission_failed"
        | "stale_session"
        | "state_update_failed";
      readonly sessionKey: string;
      readonly stateEffect: "none";
      readonly status: "rejected";
      readonly trigger: PublicationTrigger;
    };

/** Observable result of projecting authority into the rich editor. */
export type SynchronizationResult =
  | {
      readonly cause: "checkpoint_restore" | "creation" | "source_to_wysiwyg";
      readonly exactAuthority: string;
      readonly projection: string;
      readonly sessionKey: string;
      readonly stateEffect: "none";
      readonly status: "synchronized";
    }
  | {
      readonly cause: "already_current" | "same_mode";
      readonly sessionKey: string;
      readonly stateEffect: "none";
      readonly status: "no_change";
    }
  | {
      readonly cause: "checkpoint_restore" | "creation" | "source_to_wysiwyg";
      readonly reason:
        | "document_replace_failed"
        | "editor_not_ready"
        | "projection_read_failed"
        | "stale_session";
      readonly sessionKey: string;
      readonly stateEffect: "none";
      readonly status: "failed";
    };

/** Same-session action that must retain the current live projection first. */
export type CommitCause =
  | "mode_switch"
  | "manual_save"
  | "route_transition"
  | "visibilitychange"
  | "pagehide";

/** Exact result of committing a live rich-editor projection. */
export type CommitResult =
  | {
      readonly cause: CommitCause;
      readonly publication: Extract<
        PublicationResult,
        { status: "acknowledged" }
      >;
      readonly sessionKey: string;
      readonly status: "acknowledged";
    }
  | {
      readonly cause: CommitCause;
      readonly reason: "projection_unchanged" | "source_authority_current";
      readonly revision: number;
      readonly sessionKey: string;
      readonly status: "no_change";
    }
  | {
      readonly cause: CommitCause;
      readonly reason:
        "editor_not_ready" | "projection_read_failed" | "stale_session";
      readonly sessionKey: string;
      readonly status: "failed";
    }
  | {
      readonly cause: CommitCause;
      readonly publication: Extract<PublicationResult, { status: "rejected" }>;
      readonly reason: "publication_rejected";
      readonly sessionKey: string;
      readonly status: "failed";
    };
