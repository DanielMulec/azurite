import { describe, expect, it } from "vitest";

import { createWorkspaceDiscoveryPlaceholderMessage } from "../src/index.js";

describe("createWorkspaceDiscoveryPlaceholderMessage", () => {
  it("describes the next core slice", () => {
    expect(createWorkspaceDiscoveryPlaceholderMessage()).toBe(
      "Workspace discovery will be implemented in the next slice.",
    );
  });
});
