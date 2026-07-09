import { describe, expect, it, vi } from "vitest";

import { parseWebSentryConfig } from "../src/config/sentry-config.js";
import { initializeWebSentry } from "../src/observability/initialize-web-sentry.js";

describe("initializeWebSentry", () => {
  it("does not import the SDK runtime when disabled", async () => {
    const importRuntime = vi.fn();

    await expect(
      initializeWebSentry(parseWebSentryConfig({}), importRuntime),
    ).resolves.toBe(false);
    expect(importRuntime).not.toHaveBeenCalled();
  });

  it("imports and initializes the runtime when explicitly enabled", async () => {
    const initializeWebSentryRuntime = vi.fn();
    const config = parseWebSentryConfig({
      VITE_SENTRY_DSN: "https://public@example.invalid/1",
      VITE_SENTRY_ENABLED: "true",
    });
    const importRuntime = vi.fn(() =>
      Promise.resolve({ initializeWebSentryRuntime }),
    );

    await expect(initializeWebSentry(config, importRuntime)).resolves.toBe(
      true,
    );
    expect(initializeWebSentryRuntime).toHaveBeenCalledWith(config);
  });
});
