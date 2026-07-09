import { describe, expect, it } from "vitest";

import {
  apiQueryParameters,
  apiRoutes,
  createNoteContentRoute,
  createSaveNoteRoute,
  developmentRequestHeaders,
  developmentRequestHeaderValues,
} from "../src/index.js";

describe("apiRoutes", () => {
  it("defines stable API route paths", () => {
    expect(apiRoutes).toEqual({
      devSentryTestEvent: "/__azurite/dev/sentry-test-event",
      health: "/health",
      noteContent: "/api/notes/content",
      notes: "/api/notes",
    });
  });

  it("defines stable API query parameter names", () => {
    expect(apiQueryParameters).toEqual({
      noteId: "noteId",
    });
  });

  it("defines the explicit development diagnostics confirmation contract", () => {
    expect(developmentRequestHeaders).toEqual({
      sentryTestEventConfirmation: "x-azurite-dev-test-event",
    });
    expect(developmentRequestHeaderValues).toEqual({
      sentryTestEventConfirmation: "sentry",
    });
  });
});

describe("createNoteContentRoute", () => {
  it("builds an encoded note-content route", () => {
    expect(createNoteContentRoute("Projects/azurite.md")).toBe(
      "/api/notes/content?noteId=Projects%2Fazurite.md",
    );
  });
});

describe("createSaveNoteRoute", () => {
  it("returns the note-content route used for manual saves", () => {
    expect(createSaveNoteRoute()).toBe("/api/notes/content");
  });
});
