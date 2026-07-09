import {
  apiRoutes,
  developmentRequestHeaders,
  developmentRequestHeaderValues,
  runtimeObservabilityAttributeNames,
  runtimeObservabilityEventNames,
  sentryTestEventMarker,
  sentryTestEventResponseSchema,
  type SentryTestEventResponse,
} from "@azurite/shared";

import type { WebSentryConfig } from "../config/sentry-config.js";
import {
  captureWebRuntimeError,
  recordWebRuntimeEvent,
  runWebRuntimeSpan,
} from "./web-runtime-observability.js";

/** Emits the explicit browser test event and warning/error console evidence. */
export function triggerWebSentryTestEvent(config: WebSentryConfig): void {
  const event = createWebTestEvent(config);
  recordWebRuntimeEvent(event);
  captureWebRuntimeError(
    new Error("Azurite deliberate web Sentry test event."),
    event,
  );
  emitConsoleEvidence(config);
}

/** Calls the explicit backend test route inside a traced browser span. */
export async function triggerServerSentryTestEvent(
  config: WebSentryConfig,
): Promise<SentryTestEventResponse> {
  return runWebRuntimeSpan(createWebTestEvent(config), async () => {
    const response = await fetch(apiRoutes.devSentryTestEvent, {
      headers: {
        [developmentRequestHeaders.sentryTestEventConfirmation]:
          developmentRequestHeaderValues.sentryTestEventConfirmation,
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `Server test event failed with HTTP ${String(response.status)}.`,
      );
    }

    return sentryTestEventResponseSchema.parse(
      (await response.json()) as unknown,
    );
  });
}

function createWebTestEvent(config: WebSentryConfig) {
  return {
    attributes: {
      [runtimeObservabilityAttributeNames.environment]: config.environment,
      [runtimeObservabilityAttributeNames.release]: config.release,
      [runtimeObservabilityAttributeNames.testEvent]: true,
      [runtimeObservabilityAttributeNames.testMarker]: sentryTestEventMarker,
    },
    name: runtimeObservabilityEventNames.webTestTriggered,
    surface: "web",
  } as const;
}

function emitConsoleEvidence(config: WebSentryConfig): void {
  const message = `Azurite deliberate Sentry console warning: ${sentryTestEventMarker}`;
  recordWebRuntimeEvent({
    attributes: {
      [runtimeObservabilityAttributeNames.consoleLevel]: "warn",
      [runtimeObservabilityAttributeNames.environment]: config.environment,
      [runtimeObservabilityAttributeNames.messageSummary]: message,
    },
    name: runtimeObservabilityEventNames.consoleCaptured,
    surface: "web",
  });

  // This explicit warning is the QA carrier that proves SDK console capture.
  // eslint-disable-next-line no-console
  console.warn(message);
}
