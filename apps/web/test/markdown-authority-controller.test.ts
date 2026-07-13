import { describe, expect, it, vi } from "vitest";

import { MarkdownAuthorityController } from "../src/components/markdown-authority-controller.js";
import type {
  PublicationCommand,
  PublicationResult,
} from "../src/domain/markdown-authority-types.js";

describe("Markdown authority creation", () => {
  it("records a normalized setup projection without publishing it", () => {
    const harness = createHarness({
      initialMarkdown: "- exact item\n",
      projection: "* exact item\n",
    });

    expect(harness.controller.markReady()).toMatchObject({
      exactAuthority: "- exact item\n",
      projection: "* exact item\n",
      status: "synchronized",
    });
    expect(harness.publish).not.toHaveBeenCalled();
    expect(harness.controller.commit("manual_save")).toMatchObject({
      reason: "projection_unchanged",
      status: "no_change",
    });
  });

  it("keeps pre-ready source input authoritative and synchronizes after ready", () => {
    const harness = createHarness({ projection: "# Stale construction" });

    expect(harness.controller.showSource()).toMatchObject({
      status: "no_change",
    });
    harness.controller.publishSource("# Exact pre-ready edit");
    expect(harness.publish).toHaveBeenCalledOnce();
    expect(harness.controller.getSnapshot()).toMatchObject({
      lifecycle: "creating",
      mode: "markdown",
      sourceMarkdown: "# Exact pre-ready edit",
    });

    harness.controller.markReady();
    expect(harness.controller.showWysiwyg()).toMatchObject({
      exactAuthority: "# Exact pre-ready edit",
      status: "synchronized",
    });
    expect(harness.replaceProjection).toHaveBeenCalledWith(
      "# Exact pre-ready edit",
    );
    expect(harness.publish).toHaveBeenCalledOnce();
  });

  it("falls back to exact source when creation fails", () => {
    const harness = createHarness();

    harness.controller.markFailed("Creation failed.");

    expect(harness.controller.getSnapshot()).toMatchObject({
      editorError: "Creation failed.",
      lifecycle: "failed",
      mode: "markdown",
      sourceMarkdown: "# Exact",
    });
    expect(harness.modes).toEqual(["markdown"]);
    expect(harness.publish).not.toHaveBeenCalled();
  });
});

describe("Markdown authority accepted changes", () => {
  it("publishes one WYSIWYG change and restores exact checkpoint syntax on Undo", () => {
    const harness = createHarness({
      initialMarkdown: "- exact item\n",
      projection: "* exact item\n",
    });
    harness.controller.markReady();

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
    expect(harness.controller.getSnapshot().sourceMarkdown).toBe(
      "- exact item\n",
    );
  });

  it("captures a live edit synchronously before source mode", () => {
    const harness = createHarness();
    harness.controller.markReady();
    harness.setProjection("# Edited before listener debounce");

    expect(harness.controller.showSource()).toMatchObject({
      status: "acknowledged",
    });
    expect(harness.commands).toHaveLength(1);
    expect(harness.commands[0]).toMatchObject({
      markdown: "# Edited before listener debounce",
      trigger: "pre_mode_switch",
    });
    expect(harness.controller.getSnapshot()).toMatchObject({
      mode: "markdown",
      sourceMarkdown: "# Edited before listener debounce",
    });
  });

  it("ignores listener work before readiness, in source, and after destruction", () => {
    const harness = createHarness();

    expect(harness.controller.publishWysiwyg("# Early")).toMatchObject({
      reason: "lifecycle",
      status: "ignored",
    });
    harness.controller.markReady();
    harness.controller.showSource();
    expect(harness.controller.publishWysiwyg("# Hidden")).toMatchObject({
      reason: "inactive_mode",
      status: "ignored",
    });
    harness.controller.destroy();
    expect(harness.controller.publishWysiwyg("# Late")).toMatchObject({
      reason: "lifecycle",
      status: "ignored",
    });
    expect(harness.publish).not.toHaveBeenCalled();
  });
});

describe("Markdown authority failure ownership", () => {
  it("retains a rejected value and publishes it once through explicit retry", () => {
    let reject = true;
    const harness = createHarness({
      publishResult: (command, revision) =>
        reject ? rejected(command, revision) : acknowledged(command, revision),
    });
    harness.controller.markReady();

    expect(harness.controller.publishWysiwyg("# Retry me")).toMatchObject({
      publication: { status: "rejected" },
    });
    expect(harness.controller.getSnapshot()).toMatchObject({
      hasPublicationRetry: true,
    });
    reject = false;

    expect(harness.controller.retryPublication()).toMatchObject({
      publication: { status: "acknowledged", trigger: "explicit_retry" },
    });
    expect(harness.commands).toHaveLength(2);
    expect(harness.commands[1]?.markdown).toBe("# Retry me");
    expect(harness.controller.getSnapshot()).toMatchObject({
      editorError: undefined,
      hasPublicationRetry: false,
    });
  });

  it("cancels a rejected source retry when visible input returns to authority", () => {
    const harness = createHarness({
      publishResult: (command, revision) => rejected(command, revision),
    });
    harness.controller.showSource();
    harness.controller.publishSource("# Rejected");

    expect(harness.controller.publishSource("# Exact")).toMatchObject({
      publication: { reason: "retry_reverted", status: "no_change" },
    });
    expect(harness.publish).toHaveBeenCalledOnce();
    expect(harness.controller.getSnapshot()).toMatchObject({
      hasPublicationRetry: false,
      sourceMarkdown: "# Exact",
    });
  });

  it("reports a projection read failure instead of a clean commit", () => {
    const harness = createHarness();
    harness.controller.markReady();
    harness.failProjectionRead();

    expect(harness.controller.commit("route_transition")).toEqual({
      cause: "route_transition",
      reason: "projection_read_failed",
      sessionKey: "session-1",
      status: "failed",
    });
  });
});

type HarnessOptions = {
  readonly initialMarkdown?: string;
  readonly projection?: string;
  readonly publishResult?: (
    command: PublicationCommand,
    revision: number,
  ) => PublicationResult;
};

function createHarness(options: HarnessOptions = {}) {
  let projection = options.projection ?? options.initialMarkdown ?? "# Exact";
  let throwRead = false;
  let revision = 0;
  const commands: PublicationCommand[] = [];
  const modes: string[] = [];
  const publish = vi.fn((command: PublicationCommand) => {
    revision += 1;
    commands.push(command);
    return (options.publishResult ?? acknowledged)(command, revision);
  });
  const replaceProjection = vi.fn((markdown: string) => {
    projection = markdown;
  });
  const controller = new MarkdownAuthorityController({
    initialDisposition: "none",
    initialMarkdown: options.initialMarkdown ?? "# Exact",
    initialMode: "wysiwyg",
    initialRevision: 0,
    onModeChange: (mode) => {
      modes.push(mode);
    },
    publish,
    readProjection: () => {
      if (throwRead) {
        throw new Error("Injected projection failure.");
      }
      return projection;
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
    modes,
    publish,
    replaceProjection,
    setProjection: (markdown: string) => {
      projection = markdown;
    },
  };
}

function acknowledged(
  command: PublicationCommand,
  revision: number,
): PublicationResult {
  return {
    completion: "normal",
    disposition: "generated_pending",
    editorMode: "wysiwyg",
    markdown: command.markdown,
    origin: command.origin,
    persistenceIssue: undefined,
    resolution: command.resolution,
    revision,
    sessionKey: command.sessionKey,
    snapshotKey: `snapshot-${String(revision)}`,
    stateEffect: "revision_applied",
    status: "acknowledged",
    trigger: command.trigger,
  };
}

function rejected(
  command: PublicationCommand,
  revision: number,
): PublicationResult {
  return {
    attemptedMarkdown: command.markdown,
    attemptedRevision: revision,
    disposition: "none",
    origin: command.origin,
    reason: "snapshot_admission_failed",
    sessionKey: command.sessionKey,
    stateEffect: "none",
    status: "rejected",
    trigger: command.trigger,
  };
}
