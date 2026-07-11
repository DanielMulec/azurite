import { correlationIdKinds, type ApiRequestMetadata } from "@azurite/shared";

import { createBrowserCorrelationId } from "../observability/browser-correlation.js";

/** Creates immutable metadata for one list HTTP attempt. */
export function createRequestMetadata(): ApiRequestMetadata {
  const requestId = createBrowserCorrelationId(correlationIdKinds.request);
  return Object.freeze(requestId === undefined ? {} : { requestId });
}

/** Creates immutable metadata for one note operation and its HTTP attempt. */
export function createNoteRequestMetadata(): ApiRequestMetadata {
  const noteOperationId = createBrowserCorrelationId(
    correlationIdKinds.noteOperation,
  );
  const requestId = createBrowserCorrelationId(correlationIdKinds.request);
  return Object.freeze({
    ...(noteOperationId === undefined ? {} : { noteOperationId }),
    ...(requestId === undefined ? {} : { requestId }),
  });
}
