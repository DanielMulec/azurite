import { sentryTestEventMarker } from "@azurite/shared";
import type { ReactElement } from "react";
import { useState } from "react";

import type { WebSentryConfig } from "../config/sentry-config.js";
import {
  triggerServerSentryTestEvent,
  triggerWebSentryTestEvent,
} from "../observability/web-sentry-test-events.js";

type DiagnosticsResult =
  | { readonly status: "error"; readonly text: string }
  | { readonly status: "idle" }
  | { readonly status: "sent"; readonly text: string };

/** Checks every development and URL gate required before rendering controls. */
export function isSentryDiagnosticsPanelEnabled(
  config: WebSentryConfig,
  diagnosticsState: "sentry-test" | undefined,
): boolean {
  return (
    config.development &&
    config.testEventsEnabled &&
    diagnosticsState === "sentry-test"
  );
}

/** Explicit development controls for proving Slice 7A telemetry delivery. */
export function SentryDiagnosticsPanel({
  config,
}: {
  readonly config: WebSentryConfig;
}): ReactElement {
  const [webResult, setWebResult] = useState<DiagnosticsResult>({
    status: "idle",
  });
  const [serverResult, setServerResult] = useState<DiagnosticsResult>({
    status: "idle",
  });

  return (
    <section className="md:col-span-2 rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-semibold">Sentry runtime diagnostics</h2>
          <p className="mt-1 max-w-3xl">
            These controls are development-only, explicit, and non-mutating.
            Sentry is currently {config.enabled ? "enabled" : "disabled"}.
          </p>
        </div>
        <code
          className="rounded bg-white/80 px-2 py-1 text-xs"
          data-sentry-unmask
          data-testid="sentry-replay-marker"
        >
          {sentryTestEventMarker}
        </code>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded bg-amber-900 px-3 py-2 font-medium text-white"
          onClick={() => {
            triggerWebSentryTestEvent(config);
            setWebResult({
              status: "sent",
              text: "Web event and console evidence emitted.",
            });
          }}
          type="button"
        >
          Send web test event
        </button>
        <button
          className="rounded border border-amber-900 px-3 py-2 font-medium"
          onClick={() => {
            void sendServerTestEvent(config, setServerResult);
          }}
          type="button"
        >
          Send server test event
        </button>
      </div>
      <DiagnosticsResultText label="Web" result={webResult} />
      <DiagnosticsResultText label="Server" result={serverResult} />
    </section>
  );
}

async function sendServerTestEvent(
  config: WebSentryConfig,
  setResult: (result: DiagnosticsResult) => void,
): Promise<void> {
  try {
    const response = await triggerServerSentryTestEvent(config);
    setResult({
      status: "sent",
      text: `Server event sent; sentry-trace=${String(response.traceHeaders.sentryTrace)}, baggage=${String(response.traceHeaders.baggage)}.`,
    });
  } catch (error) {
    setResult({
      status: "error",
      text: error instanceof Error ? error.message : String(error),
    });
  }
}

function DiagnosticsResultText({
  label,
  result,
}: {
  readonly label: string;
  readonly result: DiagnosticsResult;
}): ReactElement | null {
  if (result.status === "idle") {
    return null;
  }

  return (
    <p
      className="mt-2"
      data-status={result.status}
      role={result.status === "error" ? "alert" : "status"}
    >
      {label}: {result.text}
    </p>
  );
}
