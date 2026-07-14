import { retryDraftPersistenceAction } from "./note-browser-authority-actions.js";
import { retryDraftCleanupAction } from "./note-browser-cleanup-actions.js";
import type { DraftRetryAction } from "../persistence/draft-workflow-types.js";
import type { DraftWorkflowAccess } from "./note-browser-draft-runtime.js";

/** Runs the one ordinary retry currently permitted by exact Zustand issue state. */
export async function retryDraftPersistenceIssueAction(
  workflow: DraftWorkflowAccess,
  retryBrowserRecovery: () => Promise<void>,
): Promise<void> {
  const noteState = workflow.state.getState().noteState;
  if (noteState.status !== "ready") {
    return;
  }
  const action = noteState.editor.persistenceIssue?.retryAction;
  if (action !== undefined) {
    await runOrdinaryRetry(action, workflow, retryBrowserRecovery);
  }
}

async function runOrdinaryRetry(
  action: DraftRetryAction,
  workflow: DraftWorkflowAccess,
  retryBrowserRecovery: () => Promise<void>,
): Promise<void> {
  if (action === "retry_browser_recovery") {
    await retryBrowserRecovery();
    return;
  }
  if (action === "retry_draft_cleanup") {
    await retryDraftCleanupAction(workflow);
    return;
  }
  if (action === "retry_draft_persistence") {
    await retryDraftPersistenceAction(workflow);
  }
  // retry_discard remains inside the terminal Discard workflow.
}
