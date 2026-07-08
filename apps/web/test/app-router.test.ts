import { describe, expect, it } from "vitest";

import { parseAppSearch } from "../src/app-router.js";

describe("app router search parsing", () => {
  it("parses selected note search state from the URL", () => {
    expect(
      parseAppSearch({ note: "Phone QA/slice-5-conflict-test.md" }),
    ).toEqual({
      note: "Phone QA/slice-5-conflict-test.md",
    });
  });

  it("decodes selected note search state before validation", () => {
    expect(parseAppSearch({ note: "Phone%20QA%2Fslice.md" })).toEqual({
      note: "Phone QA/slice.md",
    });
  });

  it("drops non-string selected note search state", () => {
    expect(parseAppSearch({ note: 42 })).toEqual({});
    expect(parseAppSearch({})).toEqual({});
  });

  it.each([
    "",
    "../secret.md",
    "..%2Fsecret.md",
    "%2Ftmp%2Fsecret.md",
    "/tmp/secret.md",
    ".azurite/cache.md",
  ])("drops unsafe selected note search state %s", (note) => {
    expect(parseAppSearch({ note })).toEqual({});
  });
});
