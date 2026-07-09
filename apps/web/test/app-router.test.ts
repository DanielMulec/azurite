import { describe, expect, it } from "vitest";

import { parseAppLocationSearch, parseAppSearch } from "../src/app-router.js";

describe("app router search parsing", () => {
  it("parses selected note search state from the URL", () => {
    expect(
      parseAppSearch({ note: "Phone QA/slice-5-conflict-test.md" }),
    ).toEqual({
      note: "Phone QA/slice-5-conflict-test.md",
    });
  });

  it("parses browser URL search through one decoding boundary", () => {
    expect(parseAppLocationSearch("?note=Phone%20QA%2Fslice.md")).toEqual({
      note: "Phone QA/slice.md",
    });
  });

  it("parses only the supported development diagnostics state", () => {
    expect(
      parseAppLocationSearch("?note=index.md&azurite-dev=sentry-test"),
    ).toEqual({
      "azurite-dev": "sentry-test",
      note: "index.md",
    });
    expect(
      parseAppLocationSearch("?note=index.md&azurite-dev=unsupported"),
    ).toEqual({ note: "index.md" });
  });

  it("preserves safe percent-containing note IDs", () => {
    expect(parseAppSearch({ note: "100%.md" })).toEqual({
      note: "100%.md",
    });
    expect(parseAppLocationSearch("?note=100%25.md")).toEqual({
      note: "100%.md",
    });
  });

  it("does not double-decode encoded-looking filenames", () => {
    expect(parseAppLocationSearch("?note=foo%252Fbar.md")).toEqual({
      note: "foo%2Fbar.md",
    });
  });

  it("drops non-string selected note search state", () => {
    expect(parseAppSearch({ note: 42 })).toEqual({});
    expect(parseAppSearch({})).toEqual({});
  });

  it.each(["", "../secret.md", "/tmp/secret.md", ".azurite/cache.md"])(
    "drops unsafe normalized selected note search state %s",
    (note) => {
      expect(parseAppSearch({ note })).toEqual({});
    },
  );

  it.each(["?note=..%2Fsecret.md", "?note=%2Ftmp%2Fsecret.md"])(
    "drops unsafe encoded browser location search %s",
    (note) => {
      expect(parseAppLocationSearch(note)).toEqual({});
    },
  );
});
