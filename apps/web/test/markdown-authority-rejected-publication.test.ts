import { describe, expect, it, vi } from "vitest";

import { createMarkdownAuthorityComposition } from "./markdown-authority-composition-test-helpers.js";

const rejectionReason = "snapshot_admission_failed" as const;
const rejectedMarkdown = "# Visible rejected";

describe("rejected Markdown publication commits", () => {
  it("blocks manual Save and route commits with the exact rejection reason", () => {
    const composition = createRejectedComposition();

    expect(composition.controller.commit("manual_save")).toEqual({
      reason: rejectionReason,
      status: "block",
    });
    expect(composition.controller.commit("route_transition")).toEqual({
      reason: rejectionReason,
      status: "block",
    });
  });

  it("makes the real gate cancel handoff before freeze or durability work", async () => {
    const composition = createRejectedComposition();
    const flush = vi.spyOn(composition.store.getState(), "flushPendingDraft");

    await expect(
      composition.gate.routeGate.prepare({
        cause: "note_list",
        leaseKey: "rejected-publication",
        outgoingOwnerKey: composition.controller.sessionKey,
      }),
    ).resolves.toEqual({
      reason: "prerequisite_failed",
      status: "cancel",
    });

    expect(flush).not.toHaveBeenCalled();
    expect(composition.gate.getSnapshot().frozenSessionKey).toBeUndefined();
  });

  it("prevents lifecycle finalization from flushing older accepted Markdown", async () => {
    const composition = createRejectedComposition();
    const flush = vi.spyOn(composition.store.getState(), "flushPendingDraft");

    expect(composition.controller.commit("unmount")).toEqual({
      reason: rejectionReason,
      status: "block",
    });
    await composition.gate.commitLifecycle("unmount");

    expect(flush).not.toHaveBeenCalled();
    expect(composition.getEditor().currentMarkdown).toBe("# Home");
  });
});

describe("rejected Markdown publication settlement", () => {
  it("publishes the exact retry into Zustand and clears every operation block", () => {
    const composition = createRejectedComposition();
    composition.acceptPublications();

    expect(composition.controller.retryPublication()).toEqual({
      status: "accepted",
    });
    expect(composition.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        markdown: rejectedMarkdown,
        trigger: "explicit_retry",
      }),
    );
    expect(composition.getEditor().currentMarkdown).toBe(rejectedMarkdown);
    expect(composition.controller.getSnapshot()).toMatchObject({
      editorError: undefined,
      hasPublicationRetry: false,
      rejectedMarkdown: undefined,
    });
    expect(composition.controller.commit("manual_save")).toEqual({
      status: "proceed",
    });
    expect(composition.controller.commit("route_transition")).toEqual({
      status: "proceed",
    });
  });

  it("clears an obsolete rejection when source returns to Zustand authority", () => {
    const composition = createRejectedComposition();

    expect(composition.controller.publishSource("# Home")).toEqual({
      status: "accepted",
    });

    expect(composition.publish).toHaveBeenCalledOnce();
    expect(composition.controller.getSnapshot()).toMatchObject({
      editorError: undefined,
      hasPublicationRetry: false,
      rejectedMarkdown: undefined,
    });
    expect(composition.controller.commit("manual_save")).toEqual({
      status: "proceed",
    });
  });
});

function createRejectedComposition() {
  const composition = createMarkdownAuthorityComposition();
  composition.controller.showSource();
  composition.rejectPublications(rejectionReason);
  expect(composition.controller.publishSource(rejectedMarkdown)).toEqual({
    reason: rejectionReason,
    status: "rejected",
  });
  expect(composition.getEditor().currentMarkdown).toBe("# Home");
  return composition;
}
