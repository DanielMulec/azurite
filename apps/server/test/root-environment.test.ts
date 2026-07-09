import { describe, expect, it, vi } from "vitest";

import {
  loadRootLocalEnvironment,
  rootLocalEnvironmentPath,
} from "../src/config/root-environment.js";

describe("root local environment", () => {
  it("loads the repository-root .env.local path", () => {
    const loader = vi.fn();

    expect(loadRootLocalEnvironment(loader)).toBe(true);
    expect(loader).toHaveBeenCalledWith(rootLocalEnvironmentPath);
    expect(rootLocalEnvironmentPath).toMatch(/\/azurite\/\.env\.local$/);
  });

  it("treats a missing .env.local as normal disabled startup", () => {
    const missingFileError = Object.assign(new Error("missing"), {
      code: "ENOENT",
    });

    expect(
      loadRootLocalEnvironment(() => {
        throw missingFileError;
      }),
    ).toBe(false);
  });

  it("does not hide malformed or unreadable environment files", () => {
    expect(() =>
      loadRootLocalEnvironment(() => {
        throw new Error("unreadable");
      }),
    ).toThrow("unreadable");
  });
});
