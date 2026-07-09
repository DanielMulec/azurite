import type { ErrorInfo, ReactNode } from "react";
import { Component, type ReactElement } from "react";

import { captureWebRuntimeError } from "../observability/web-runtime-observability.js";

type AzuriteErrorBoundaryProps = {
  readonly children: ReactNode;
};

type AzuriteErrorBoundaryState = {
  readonly failed: boolean;
};

/** Captures otherwise-unhandled React render failures without changing normal UI. */
export class AzuriteErrorBoundary extends Component<
  AzuriteErrorBoundaryProps,
  AzuriteErrorBoundaryState
> {
  override state: AzuriteErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AzuriteErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureWebRuntimeError(error, {
      attributes: {
        "react.component_stack": errorInfo.componentStack ?? undefined,
      },
      name: "telemetry.web.error_boundary.captured",
      surface: "web",
    });
  }

  override render(): ReactElement | ReactNode {
    if (this.state.failed) {
      return (
        <main className="min-h-screen bg-[var(--azurite-background)] p-8 text-[var(--azurite-text)]">
          <h1 className="text-2xl font-semibold">Azurite could not render.</h1>
          <p className="mt-3 text-[var(--azurite-muted)]">
            Reload the page after inspecting the local debug evidence.
          </p>
        </main>
      );
    }

    return this.props.children;
  }
}
