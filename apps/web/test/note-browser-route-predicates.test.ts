import { describe, expect, it } from "vitest";

import type { ActiveNoteLoad } from "../src/state/note-browser-contracts.js";
import { createNoteRequestMetadata } from "../src/state/note-operation-metadata.js";
import {
  getCoherentRouteView,
  getRenderedOwnerKey,
} from "../src/state/note-browser-route-predicates.js";
import { createLoadedStore } from "./note-browser-store-test-helpers.js";
import { createTestOccurrence } from "./note-browser-route-test-helpers.js";

describe("route coherence predicates", () => {
  it("reports the rendered A owner while selected B prevents an A no-op", () => {
    const store = createLoadedStore();
    const occurrence = createTestOccurrence("index.md", 0);
    store.setState({ selectedNoteId: "Projects/azurite.md" });

    expect(getRenderedOwnerKey(store.getState())).toBe(
      "index.md:sha256-home:1",
    );
    expect(
      getCoherentRouteView(
        { activeLoad: undefined, noteId: "index.md", occurrence },
        store.getState(),
      ),
    ).toBeUndefined();
  });

  it("rejects an otherwise coherent occurrence while another load is active", () => {
    const store = createLoadedStore();
    const occurrence = createTestOccurrence("index.md", 0);

    expect(
      getCoherentRouteView(
        { activeLoad: createConflictingLoad(), noteId: "index.md", occurrence },
        store.getState(),
      ),
    ).toBeUndefined();
    expect(
      getCoherentRouteView(
        { activeLoad: undefined, noteId: "index.md", occurrence },
        store.getState(),
      ),
    ).toEqual({ status: "coherent_noop", view: "ready" });
  });
});

describe("ownerless route coherence predicates", () => {
  it.each([
    { noteId: "missing.md", status: "missing", view: "missing" },
    { noteId: "broken.md", status: "error", view: "error" },
  ] as const)("recognizes a coherent $view terminal surface", (input) => {
    const store = createLoadedStore();
    const occurrence = createTestOccurrence(input.noteId, 2);
    store.setState({
      committedRouteView: {
        location: occurrence,
        noteId: input.noteId,
        renderedOwnerKey: undefined,
        view: input.view,
      },
      noteState:
        input.status === "missing"
          ? { noteId: input.noteId, status: "missing" }
          : { message: "Read failed.", noteId: input.noteId, status: "error" },
      selectedNoteId: input.noteId,
    });

    expect(
      getCoherentRouteView(
        { activeLoad: undefined, noteId: input.noteId, occurrence },
        store.getState(),
      ),
    ).toEqual({ status: "coherent_noop", view: input.view });
    expect(getRenderedOwnerKey(store.getState())).toBeUndefined();
  });
});

describe("empty and missing-draft route coherence predicates", () => {
  it("recognizes coherent empty and missing-draft ownership", () => {
    const store = createLoadedStore();
    const empty = createTestOccurrence(undefined, 3);
    store.setState({
      committedRouteView: {
        location: empty,
        noteId: undefined,
        renderedOwnerKey: undefined,
        view: "empty",
      },
      noteState: { status: "idle" },
      selectedNoteId: undefined,
    });
    expect(
      getCoherentRouteView(
        { activeLoad: undefined, noteId: undefined, occurrence: empty },
        store.getState(),
      ),
    ).toEqual({ status: "coherent_noop", view: "empty" });

    applyMissingDraftState(store);
    expect(getRenderedOwnerKey(store.getState())).toBe("missing-owner");
    expect(
      getCoherentRouteView(
        {
          activeLoad: undefined,
          noteId: "missing.md",
          occurrence: createTestOccurrence("missing.md", 4),
        },
        store.getState(),
      ),
    ).toEqual({ status: "coherent_noop", view: "missing_draft" });
  });
});

function createConflictingLoad(): ActiveNoteLoad {
  return {
    authorization: {
      authorizationKey: "conflicting:authorization",
      intentKey: "conflicting",
      kind: "route_intent",
    },
    metadata: createNoteRequestMetadata(),
    noteId: "Projects/azurite.md",
    promise: Promise.resolve({ status: "stale" }),
    requestSequence: 2,
    routeSource: "url_sync",
  };
}

function applyMissingDraftState(
  store: ReturnType<typeof createLoadedStore>,
): void {
  const occurrence = createTestOccurrence("missing.md", 4);
  store.setState({
    committedRouteView: {
      location: occurrence,
      noteId: "missing.md",
      renderedOwnerKey: "missing-owner",
      view: "missing_draft",
    },
    noteState: {
      draft: {
        editorMode: "wysiwyg",
        markdown: "# Recovered",
        updatedAt: "2026-07-13T10:00:00.000Z",
      },
      noteId: "missing.md",
      renderedOwnerKey: "missing-owner",
      status: "missing-draft",
    },
    selectedNoteId: "missing.md",
  });
}
