import { retryDraftPersistenceAction } from "./note-browser-authority-actions.js";
import { retryDraftCleanupAction } from "./note-browser-cleanup-actions.js";
import type { StoreContext } from "./note-browser-contracts.js";
import { retryBrowserRecoveryAction } from "./note-browser-recovery-actions.js";
import type { DraftRetryAction } from "../persistence/draft-workflow-types.js";

/** Runs the one ordinary retry currently permitted by exact Zustand issue state. */
export async function retryDraftPersistenceIssueAction(
  context: StoreContext,
): Promise<void> {
  const noteState = context.get().noteState;
  if (noteState.status !== "ready") {
    return;
  }
  const action = noteState.editor.persistenceIssue?.retryAction;
  if (action !== undefined) {
    await runOrdinaryRetry(action, context);
  }
}

async function runOrdinaryRetry(
  action: DraftRetryAction,
  context: StoreContext,
): Promise<void> {
  const retry = ordinaryRetries[action];
  if (retry !== undefined) {
    await retry(context);
  }
}

const ordinaryRetries = {
  retry_browser_recovery: retryBrowserRecoveryAction,
  retry_discard: undefined,
  retry_draft_cleanup: retryDraftCleanupAction,
  retry_draft_persistence: retryDraftPersistenceAction,
} satisfies Record<
  DraftRetryAction,
  ((context: StoreContext) => Promise<void>) | undefined
>;
