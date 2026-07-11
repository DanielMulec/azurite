import {
  NoteResolutionError,
  NoteWriteError,
  WorkspaceResolutionError,
} from "@azurite/core";
import {
  apiErrorCodes,
  createApiErrorResponse,
  type ApiErrorCode,
  type ApiErrorResponse,
} from "@azurite/shared";

/** Safe public error and status produced by a note route. */
export type SafeNoteRouteError = {
  readonly body: ApiErrorResponse;
  readonly statusCode: number;
};

/** Creates the unchanged workspace-not-configured API result. */
export function workspaceNotConfiguredError(): SafeNoteRouteError {
  return safeError(
    apiErrorCodes.workspaceNotConfigured,
    "Workspace path is not configured.",
    500,
  );
}

/** Creates the unchanged invalid-note-ID API result. */
export function invalidNoteIdError(): SafeNoteRouteError {
  return safeError(
    apiErrorCodes.invalidNoteId,
    "Note ID must be a relative markdown path.",
    400,
  );
}

/** Creates the unchanged invalid-save API result. */
export function invalidNoteSaveError(): SafeNoteRouteError {
  return safeError(
    apiErrorCodes.invalidNoteSave,
    "Save request must include a note ID, markdown, and content hash.",
    400,
  );
}

/** Maps note discovery failures onto the existing safe API contract. */
export function createDiscoveryError(error: unknown): SafeNoteRouteError {
  return error instanceof WorkspaceResolutionError
    ? safeError(
        apiErrorCodes.invalidWorkspace,
        "Configured workspace path is not a readable directory.",
        500,
      )
    : safeError(
        apiErrorCodes.noteDiscoveryFailed,
        "Unable to list workspace notes.",
        500,
      );
}

/** Maps note read failures onto the existing safe API contract. */
export function createReadNoteError(error: unknown): SafeNoteRouteError {
  if (error instanceof WorkspaceResolutionError) {
    return safeError(
      apiErrorCodes.invalidWorkspace,
      "Configured workspace path is not a readable directory.",
      500,
    );
  }
  if (error instanceof NoteResolutionError) {
    return noteResolutionError(error);
  }
  return safeError(
    apiErrorCodes.noteReadFailed,
    "Unable to read workspace note.",
    500,
  );
}

/** Maps note save failures onto the existing safe API contract. */
export function createSaveNoteError(error: unknown): SafeNoteRouteError {
  if (error instanceof WorkspaceResolutionError) {
    return invalidWorkspaceError();
  }
  return createSaveNoteErrorWithinWorkspace(error);
}

function createSaveNoteErrorWithinWorkspace(
  error: unknown,
): SafeNoteRouteError {
  if (error instanceof NoteResolutionError) {
    return noteResolutionError(error);
  }
  if (error instanceof NoteWriteError) {
    return safeError(
      error.code,
      "The note changed on disk before Azurite could save it.",
      409,
    );
  }
  return safeError(
    apiErrorCodes.noteWriteFailed,
    "Unable to save workspace note.",
    500,
  );
}

function invalidWorkspaceError(): SafeNoteRouteError {
  return safeError(
    apiErrorCodes.invalidWorkspace,
    "Configured workspace path is not a readable directory.",
    500,
  );
}

/** Whether the server owns one captured exception for this safe error. */
export function isUnexpectedNoteRouteError(code: ApiErrorCode): boolean {
  return (
    code === apiErrorCodes.noteDiscoveryFailed ||
    code === apiErrorCodes.noteReadFailed ||
    code === apiErrorCodes.noteWriteFailed
  );
}

function noteResolutionError(error: NoteResolutionError): SafeNoteRouteError {
  return error.code === apiErrorCodes.invalidNoteId
    ? invalidNoteIdError()
    : safeError(
        apiErrorCodes.noteNotFound,
        "Requested note was not found.",
        404,
      );
}

function safeError(
  code: ApiErrorCode,
  message: string,
  statusCode: number,
): SafeNoteRouteError {
  return { body: createApiErrorResponse(code, message), statusCode };
}
