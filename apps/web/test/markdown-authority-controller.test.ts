import { describe, expect, it, vi } from "vitest";

import { MarkdownAuthorityController } from "../src/components/markdown-authority-controller.js";
import type {
  PublicationCommand,
  PublicationResult,
} from "../src/domain/markdown-authority-types.js";
import type { EditorSession } from "../src/state/note-browser-types.js";
import {
  createLoadedStore,
  createNote,
} from "./note-browser-store-test-helpers.js";

describe("Markdown authority creation", () => {
  it("records a normalized setup projection without publishing it", () => {
    const harness = createHarness({
      initialMarkdown: "- exact item\n",
      projection: "* exact item\n",
    });

    expect(harness.markReady()).toEqual({
      cause: "creation",
      status: "synchronized",
    });
    expect(harness.publish).not.toHaveBeenCalled();
    expect(harness.controller.commit("manual_save")).toEqual({
      status: "proceed",
    });
  });

  it("keeps pre-ready source input authoritative and synchronizes after ready", () => {
    const harness = createHarness({ projection: "# Stale construction" });

    expect(harness.controller.showSource()).toEqual({ status: "proceed" });
    expect(harness.getSession().editorMode).toBe("markdown");
    expect(harness.controller.publishSource("# Exact pre-ready edit")).toEqual({
      status: "accepted",
    });
    expect(harness.getSession().currentMarkdown).toBe("# Exact pre-ready edit");
    expect(harness.controller.getSnapshot()).toMatchObject({
      lifecycle: "creating",
      rejectedMarkdown: undefined,
    });

    harness.markReady();
    expect(harness.controller.showWysiwyg()).toEqual({
      cause: "source_to_wysiwyg",
      status: "synchronized",
    });
    expect(harness.replaceProjection).toHaveBeenCalledWith(
      "# Exact pre-ready edit",
    );
    expect(harness.publish).toHaveBeenCalledOnce();
  });
});

describe("Markdown authority creation failures", () => {
  it("keeps the creation failure visible while source editing remains accepted", () => {
    const harness = createHarness();
    harness.controller.markFailed("Creation failed.");

    expect(harness.getSession()).toMatchObject({
      currentMarkdown: "# Exact",
      editorMode: "markdown",
    });
    expect(harness.modes).toEqual(["markdown"]);
    expect(harness.controller.publishSource("# Exact after failure")).toEqual({
      status: "accepted",
    });
    expect(harness.controller.getSnapshot()).toMatchObject({
      editorError: "Creation failed.",
      lifecycle: "failed",
      rejectedMarkdown: undefined,
    });
    expect(harness.getSession().currentMarkdown).toBe("# Exact after failure");
    expect(harness.controller.showWysiwyg()).toEqual({
      cause: "source_to_wysiwyg",
      reason: "editor_not_ready",
      status: "failed",
    });
  });
});

describe("Markdown authority accepted changes", () => {
  it("publishes one WYSIWYG change and restores exact checkpoint syntax on Undo", () => {
    const harness = createHarness({
      initialMarkdown: "- exact item\n",
      projection: "* exact item\n",
    });
    harness.markReady();

    harness.controller.publishWysiwyg("* edited item\n");
    harness.controller.publishWysiwyg("* exact item\n");

    expect(harness.publish).toHaveBeenCalledTimes(2);
    expect(harness.commands[0]).toMatchObject({
      markdown: "* edited item\n",
      resolution: "serialized_projection",
    });
    expect(harness.commands[1]).toMatchObject({
      markdown: "- exact item\n",
      resolution: "checkpoint_restore",
    });
    expect(harness.getSession().currentMarkdown).toBe("- exact item\n");
    expect(harness.controller.getSnapshot().rejectedMarkdown).toBeUndefined();
  });

  it("captures a live edit synchronously before source mode", () => {
    const harness = createHarness();
    harness.markReady();
    harness.setProjection("# Edited before listener debounce");

    expect(harness.controller.showSource()).toEqual({ status: "proceed" });
    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]).toMatchObject({
      markdown: "# Edited before listener debounce",
      trigger: "pre_mode_switch",
    });
    expect(harness.getSession()).toMatchObject({
      currentMarkdown: "# Edited before listener debounce",
      editorMode: "markdown",
    });
  });

  it("ignores listener work before readiness, in source, and after owner loss", () => {
    const harness = createHarness();

    expect(harness.controller.publishWysiwyg("# Early")).toEqual({
      reason: "lifecycle",
      status: "ignored",
    });
    harness.markReady();
    harness.controller.showSource();
    expect(harness.controller.publishWysiwyg("# Hidden")).toEqual({
      reason: "inactive_mode",
      status: "ignored",
    });
    harness.removeSession();
    expect(harness.controller.publishWysiwyg("# Late")).toEqual({
      reason: "lifecycle",
      status: "ignored",
    });
    expect(harness.publish).not.toHaveBeenCalled();
  });
});

describe("Markdown authority exact-session reads", () => {
  it("uses a mode-only revision change before its next decision", () => {
    const harness = createHarness();
    harness.markReady();
    harness.updateSession({ editorMode: "markdown", revision: 7 });

    expect(harness.controller.publishWysiwyg("# Wrong mode")).toEqual({
      reason: "inactive_mode",
      status: "ignored",
    });
    expect(harness.controller.showWysiwyg()).toEqual({
      cause: "source_to_wysiwyg",
      status: "synchronized",
    });
    expect(harness.replaceProjection).toHaveBeenCalledWith("# Exact");
    expect(harness.getSession()).toMatchObject({
      editorMode: "wysiwyg",
      revision: 8,
    });
  });

  it("uses the asynchronously settled disposition before publishing again", () => {
    const harness = createHarness();
    harness.markReady();
    harness.controller.publishWysiwyg("# First edit");
    harness.updateSession({ draftDisposition: "generated_durable" });

    expect(harness.controller.publishWysiwyg("# Second edit")).toEqual({
      status: "accepted",
    });
    expect(harness.publicationSessions.at(-1)).toMatchObject({
      currentMarkdown: "# First edit",
      draftDisposition: "generated_durable",
      revision: 1,
    });
    expect(harness.getSession()).toMatchObject({
      currentMarkdown: "# Second edit",
      revision: 2,
    });
  });
});

describe("Markdown authority failure ownership", () => {
  it("restores an availability failure after publication retry succeeds", () => {
    let reject = true;
    const harness = createHarness({
      publishResult: () => (reject ? rejected() : accepted()),
    });
    harness.controller.markFailed("Creation failed.");
    harness.controller.publishSource("# Retry after failure");
    expect(harness.controller.getSnapshot()).toMatchObject({
      editorError: "The latest editor change has not been acknowledged.",
      hasPublicationRetry: true,
      rejectedMarkdown: "# Retry after failure",
    });

    reject = false;
    expect(harness.controller.retryPublication()).toEqual({
      status: "accepted",
    });

    expect(harness.controller.getSnapshot()).toMatchObject({
      editorError: "Creation failed.",
      hasPublicationRetry: false,
      rejectedMarkdown: undefined,
    });
    expect(harness.getSession().currentMarkdown).toBe("# Retry after failure");
  });

  it("retains a rejected value and publishes it once through explicit retry", () => {
    let reject = true;
    const harness = createHarness({
      publishResult: () => (reject ? rejected() : accepted()),
    });
    harness.markReady();

    expect(harness.controller.publishWysiwyg("# Retry me")).toEqual({
      reason: "snapshot_admission_failed",
      status: "rejected",
    });
    expect(harness.controller.getSnapshot()).toMatchObject({
      hasPublicationRetry: true,
      rejectedMarkdown: "# Retry me",
    });
    reject = false;

    expect(harness.controller.retryPublication()).toEqual({
      status: "accepted",
    });
    expect(harness.commands).toHaveLength(2);
    expect(harness.commands[1]).toMatchObject({
      markdown: "# Retry me",
      trigger: "explicit_retry",
    });
    expect(harness.controller.getSnapshot()).toMatchObject({
      editorError: undefined,
      hasPublicationRetry: false,
      rejectedMarkdown: undefined,
    });
  });
});

describe("Markdown authority retry cancellation", () => {
  it("cancels a rejected source retry when visible input returns to authority", () => {
    const harness = createHarness({ publishResult: rejected });
    harness.controller.showSource();
    harness.controller.publishSource("# Rejected");

    expect(harness.controller.publishSource("# Exact")).toEqual({
      status: "accepted",
    });
    expect(harness.publish).toHaveBeenCalledOnce();
    expect(harness.controller.getSnapshot()).toMatchObject({
      hasPublicationRetry: false,
      rejectedMarkdown: undefined,
    });
    expect(harness.getSession().currentMarkdown).toBe("# Exact");
  });

  it("reports a projection read failure instead of a clean commit", () => {
    const harness = createHarness();
    harness.markReady();
    harness.failProjectionRead();

    expect(harness.controller.commit("route_transition")).toEqual({
      reason: "projection_read_failed",
      status: "block",
    });
  });
});

type HarnessOptions = {
  readonly initialMarkdown?: string;
  readonly projection?: string;
  readonly publishResult?: (
    command: PublicationCommand,
    session: EditorSession,
  ) => PublicationResult;
};

function createHarness(options: HarnessOptions = {}) {
  const initialMarkdown = options.initialMarkdown ?? "# Exact";
  let projection = options.projection ?? initialMarkdown;
  let session: EditorSession | undefined =
    createHarnessSession(initialMarkdown);
  let throwRead = false;
  const commands: PublicationCommand[] = [];
  const modes: EditorSession["editorMode"][] = [];
  const publicationSessions: EditorSession[] = [];
  const publishResult = options.publishResult ?? accepted;
  const publish = vi.fn((command: PublicationCommand): PublicationResult => {
    const current = requireSession(session);
    commands.push(command);
    publicationSessions.push(current);
    const result = publishResult(command, current);
    if (result.status === "accepted") {
      session = applyAcceptedCommand(current, command);
    }
    return result;
  });
  const replaceProjection = vi.fn((markdown: string) => {
    projection = markdown;
  });
  const controller = new MarkdownAuthorityController({
    isSessionFrozen: () => false,
    onModeChange: (mode) => {
      modes.push(mode);
      const current = requireSession(session);
      session = {
        ...current,
        editorMode: mode,
        revision:
          current.editorMode === mode ? current.revision : current.revision + 1,
      };
    },
    publish,
    readProjection: () => {
      if (throwRead) {
        throw new Error("Injected projection failure.");
      }
      return projection;
    },
    readSession: (sessionKey) => {
      return session?.sessionKey === sessionKey ? session : undefined;
    },
    replaceProjection,
    sessionKey: "session-1",
  });
  return {
    commands,
    controller,
    failProjectionRead: () => {
      throwRead = true;
    },
    getSession: () => requireSession(session),
    markReady: () => controller.markReady(initialMarkdown),
    modes,
    publicationSessions,
    publish,
    removeSession: () => {
      session = undefined;
    },
    replaceProjection,
    setProjection: (markdown: string) => {
      projection = markdown;
    },
    updateSession: (patch: Partial<EditorSession>) => {
      session = { ...requireSession(session), ...patch };
    },
  };
}

function createHarnessSession(markdown: string): EditorSession {
  const store = createLoadedStore({
    note: createNote("note.md", markdown, "sha256-exact"),
  });
  const state = store.getState().noteState;
  if (state.status !== "ready") {
    throw new Error("Expected the harness store to own an editor.");
  }
  return { ...state.editor, sessionKey: "session-1" };
}

function applyAcceptedCommand(
  session: EditorSession,
  command: PublicationCommand,
): EditorSession {
  return {
    ...session,
    currentMarkdown: command.markdown,
    draftDisposition:
      session.draftDisposition === "none"
        ? "generated_pending"
        : session.draftDisposition,
    revision: session.revision + 1,
  };
}

function requireSession(session: EditorSession | undefined): EditorSession {
  if (session === undefined) {
    throw new Error("Expected an exact editor session.");
  }
  return session;
}

function accepted(): PublicationResult {
  return { status: "accepted" };
}

function rejected(): PublicationResult {
  return { reason: "snapshot_admission_failed", status: "rejected" };
}
