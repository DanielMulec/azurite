import { describe, expect, it } from "vitest";

import { getApplicationTitle } from "../src/app-title.js";

describe("getApplicationTitle", () => {
  it("returns the shared application name", () => {
    expect(getApplicationTitle()).toBe("Azurite");
  });
});
