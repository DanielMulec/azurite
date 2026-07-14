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
  | "unmount"
  | "explicit_retry";

/** Exact-session input for one accepted authority publication. */
export type PublicationCommand = {
  readonly markdown: string;
  readonly origin: ChangeOrigin;
  readonly resolution: AuthorityResolution;
  readonly sessionKey: string;
  readonly trigger: PublicationTrigger;
};

/** Precise reason why one exact-session publication was rejected. */
export type PublicationRejectionReason =
  | "closed_epoch"
  | "snapshot_admission_failed"
  | "stale_session"
  | "state_update_failed";

/** Caller decision for one exact-session authority command. */
export type PublicationResult =
  | { readonly status: "accepted" }
  | {
      readonly reason: PublicationRejectionReason;
      readonly status: "rejected";
    };

/** Observable result of projecting authority into the rich editor. */
export type SynchronizationResult =
  | {
      readonly cause: "creation" | "source_to_wysiwyg";
      readonly status: "synchronized";
    }
  | {
      readonly cause: "same_mode";
      readonly status: "no_change";
    }
  | {
      readonly cause: "creation" | "source_to_wysiwyg";
      readonly reason:
        | "document_replace_failed"
        | "editor_not_ready"
        | "projection_read_failed"
        | "stale_session";
      readonly status: "failed";
    };

/** Same-session action that must retain the current live projection first. */
export type CommitCause =
  | "mode_switch"
  | "manual_save"
  | "route_transition"
  | "visibilitychange"
  | "pagehide"
  | "unmount";

/** Caller decision after retaining the current live rich-editor projection. */
export type CommitResult =
  | { readonly status: "proceed" }
  | {
      readonly reason: PublicationRejectionReason | "projection_read_failed";
      readonly status: "block";
    };
