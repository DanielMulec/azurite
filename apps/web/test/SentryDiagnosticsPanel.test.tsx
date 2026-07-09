// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sentryTestEventMarker } from "@azurite/shared";

const testEvents = vi.hoisted(() => ({
  triggerServerSentryTestEvent: vi.fn(() =>
    Promise.resolve({
      marker: sentryTestEventMarker,
      status: "sent" as const,
      traceHeaders: { baggage: true, sentryTrace: true },
    }),
  ),
  triggerWebSentryTestEvent: vi.fn(),
}));

vi.mock("../src/observability/web-sentry-test-events.js", () => testEvents);

import {
  isSentryDiagnosticsPanelEnabled,
  SentryDiagnosticsPanel,
} from "../src/components/SentryDiagnosticsPanel.js";
import { parseWebSentryConfig } from "../src/config/sentry-config.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SentryDiagnosticsPanel", () => {
  it("requires development, the env gate, and typed URL state", () => {
    const gatedConfig = parseWebSentryConfig({
      VITE_SENTRY_TEST_EVENTS_ENABLED: "true",
    });

    expect(isSentryDiagnosticsPanelEnabled(gatedConfig, "sentry-test")).toBe(
      true,
    );
    expect(isSentryDiagnosticsPanelEnabled(gatedConfig, undefined)).toBe(false);
    expect(
      isSentryDiagnosticsPanelEnabled(
        parseWebSentryConfig({}, false),
        "sentry-test",
      ),
    ).toBe(false);
  });

  it("keeps the Replay marker visible and requires deliberate actions", async () => {
    const config = parseWebSentryConfig({
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      VITE_SENTRY_ENABLED: "true",
      VITE_SENTRY_TEST_EVENTS_ENABLED: "true",
    });
    render(<SentryDiagnosticsPanel config={config} />);

    expect(screen.getByTestId("sentry-replay-marker")).toHaveTextContent(
      sentryTestEventMarker,
    );
    expect(testEvents.triggerWebSentryTestEvent).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Send web test event" }),
    );
    expect(testEvents.triggerWebSentryTestEvent).toHaveBeenCalledWith(config);

    fireEvent.click(
      screen.getByRole("button", { name: "Send server test event" }),
    );
    await waitFor(() => {
      expect(screen.getByText(/sentry-trace=true, baggage=true/)).toBeVisible();
    });
  });
});
