// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  MilkdownEditor,
  type MilkdownEditorProps,
} from "../src/components/MilkdownEditor.js";
import { CrepeGenerationLifecycle } from "../src/components/crepe-generation-lifecycle.js";
import type { CrepeRuntimeFactory } from "../src/components/crepe-runtime.js";
import {
  createAcknowledgingPublisher,
  createTestEditorSessionGate,
} from "./editor-session-gate-test-helpers.js";

type MockFunction = ReturnType<typeof vi.fn>;

afterEach(cleanup);

it("balances successful Crepe generations around StrictMode replay", async () => {
  const ledger = { creates: 0, destroys: 0, live: 0 };
  const createRuntime = vi.fn<CrepeRuntimeFactory>(() => {
    ledger.creates += 1;
    ledger.live += 1;
    return {
      create: () => Promise.resolve(),
      destroy: () => {
        ledger.destroys += 1;
        ledger.live -= 1;
        return Promise.resolve();
      },
      getMarkdown: () => "# Home",
      replaceMarkdown: () => {},
    };
  });

  const mounted = renderStrictEditor({ createRuntime });
  await waitFor(() => {
    expect(createRuntime).toHaveBeenCalledTimes(2);
  });
  expect(ledger).toEqual({ creates: 2, destroys: 1, live: 1 });
  mounted.unmount();
  expect(ledger).toEqual({ creates: 2, destroys: 2, live: 0 });
});

it("retains one ready isolated generation and releases every remount", async () => {
  const ledger = { creates: 0, destroys: 0, live: 0 };
  const roots = new Set<HTMLDivElement>();
  const createRuntime = vi.fn<CrepeRuntimeFactory>(({ root }) => {
    ledger.creates += 1;
    ledger.live += 1;
    roots.add(root);
    return {
      create: () => Promise.resolve(),
      destroy: () => {
        ledger.destroys += 1;
        ledger.live -= 1;
        return Promise.resolve();
      },
      getMarkdown: () => "# Home",
      replaceMarkdown: () => {},
    };
  });

  const first = renderStrictEditor({ createRuntime });
  await expectWysiwygReady();
  expect(ledger).toEqual({ creates: 2, destroys: 1, live: 1 });
  expect(roots.size).toBe(2);
  first.unmount();
  expect(ledger).toEqual({ creates: 2, destroys: 2, live: 0 });

  const second = renderStrictEditor({ createRuntime });
  await expectWysiwygReady();
  expect(ledger).toEqual({ creates: 4, destroys: 3, live: 1 });
  second.unmount();
  expect(ledger).toEqual({ creates: 4, destroys: 4, live: 0 });
});

it("waits for successful predecessor teardown and rejects stale callbacks", async () => {
  const harness = createControlledRuntimeHarness();
  const publish = vi.fn(createAcknowledgingPublisher());
  const mounted = renderStrictEditor({
    createRuntime: harness.createRuntime,
    onPublishMarkdown: publish,
  });

  expect(harness.generations).toHaveLength(1);
  expect(harness.generations[0]?.destroy).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();

  await settle(() => harness.generations[0]?.creation.resolve(undefined));
  await waitFor(() => {
    expect(harness.generations[0]?.destroy).toHaveBeenCalledOnce();
  });
  expect(harness.generations).toHaveLength(1);

  await settle(() => harness.generations[0]?.teardown.resolve(undefined));
  await waitFor(() => {
    expect(harness.generations).toHaveLength(2);
  });
  await settle(() => harness.generations[1]?.creation.resolve(undefined));
  await expectWysiwygReady();

  harness.generations[0]?.input.onMarkdownUpdated("# Retired callback");
  expect(publish).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeEnabled();

  mounted.unmount();
  expect(harness.generations[1]?.destroy).toHaveBeenCalledOnce();
  harness.generations[1]?.teardown.resolve(undefined);
});

it("releases a rejected predecessor without destroy or stale failure", async () => {
  const harness = createControlledRuntimeHarness();
  const publish = vi.fn(createAcknowledgingPublisher());
  const onEditorModeChange = vi.fn();
  const mounted = renderStrictEditor({
    createRuntime: harness.createRuntime,
    onEditorModeChange,
    onPublishMarkdown: publish,
  });

  await settle(() => {
    harness.generations[0]?.creation.reject(new Error("Stale failure."));
  });
  await waitFor(() => {
    expect(harness.generations).toHaveLength(2);
  });
  expect(harness.generations[0]?.destroy).not.toHaveBeenCalled();
  await settle(() => harness.generations[1]?.creation.resolve(undefined));
  await expectWysiwygReady();

  harness.generations[0]?.input.onMarkdownUpdated("# Retired callback");
  expect(publish).not.toHaveBeenCalled();
  expect(onEditorModeChange).not.toHaveBeenCalled();
  expect(screen.queryByText(/could not be created/u)).not.toBeInTheDocument();

  mounted.unmount();
  expect(harness.generations[1]?.destroy).toHaveBeenCalledOnce();
  harness.generations[1]?.teardown.resolve(undefined);
});

it.each(["factory", "create", "reject"] as const)(
  "keeps exact source after a %s creation failure",
  async (stage) => {
    const publish = vi.fn(createAcknowledgingPublisher());
    const onEditorModeChange = vi.fn();
    const failing = createFailingRuntime(stage);
    renderStrictEditor({
      createRuntime: failing.createRuntime,
      initialMarkdown: "# Exact survives",
      onEditorModeChange,
      onPublishMarkdown: publish,
      sessionKey: "failed-session",
    });

    expect(
      await screen.findByText("The Milkdown editor could not be created."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown source for Home")).toHaveValue(
      "# Exact survives",
    );
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();
    expect(publish).not.toHaveBeenCalled();
    expect(onEditorModeChange).toHaveBeenCalledOnce();
    expect(onEditorModeChange).toHaveBeenCalledWith("markdown");
    expect(failing.createRuntime).toHaveBeenCalledTimes(2);
    expect(failing.destroy).not.toHaveBeenCalled();
    expect([...failing.roots].every((root) => !root.isConnected)).toBe(true);

    fireEvent.change(screen.getByLabelText("Markdown source for Home"), {
      target: { value: "# Source remains usable" },
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Markdown source for Home")).toHaveValue(
      "# Source remains usable",
    );
  },
);

it("makes teardown rejection visible and keeps exact source usable", async () => {
  const publish = vi.fn(createAcknowledgingPublisher());
  const onEditorModeChange = vi.fn();
  const createRuntime = vi.fn<CrepeRuntimeFactory>(() => ({
    create: () => Promise.resolve(),
    destroy: () => Promise.reject(new Error("Injected teardown failure.")),
    getMarkdown: () => "# Exact survives",
    replaceMarkdown: () => {},
  }));
  renderStrictEditor({
    createRuntime,
    initialMarkdown: "# Exact survives",
    onEditorModeChange,
    onPublishMarkdown: publish,
  });

  expect(
    await screen.findByText(/could not be (destroyed|released)/u),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Markdown source for Home")).toHaveValue(
    "# Exact survives",
  );
  expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();
  expect(createRuntime).toHaveBeenCalledOnce();
  expect(onEditorModeChange).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText("Markdown source for Home"), {
    target: { value: "# Teardown source edit" },
  });
  expect(publish).toHaveBeenCalledOnce();
});

it("forwards the exact current create rejection and releases its host", async () => {
  const failure = new Error("Exact creation failure.");
  const destroy = vi.fn(() => Promise.resolve());
  const lifecycle = new CrepeGenerationLifecycle({
    createRuntime: () => ({
      create: () => Promise.reject(failure),
      destroy,
      getMarkdown: () => "# Unavailable",
      replaceMarkdown: () => {},
    }),
    initialMarkdown: "# Exact survives",
  });
  const container = document.createElement("div");
  const markCreationFailed = vi.fn();

  const retire = lifecycle.activate(container, {
    markCreationFailed,
    markReady: () => true,
    markTeardownFailed: vi.fn(),
    publishMarkdown: vi.fn(),
  });
  await waitFor(() => {
    expect(markCreationFailed).toHaveBeenCalledWith(failure);
  });

  expect(container.childElementCount).toBe(0);
  expect(destroy).not.toHaveBeenCalled();
  expect(() => lifecycle.requireCurrentRuntime()).toThrow(
    "The Crepe runtime is not ready.",
  );
  retire();
});

it("destroys a pending success after final unmount without a successor", async () => {
  const pending = createUnmountedPendingHarness();

  await settle(() => {
    pending.first.creation.resolve(undefined);
  });
  expect(pending.first.destroy).toHaveBeenCalledOnce();
  await settle(() => {
    pending.first.teardown.resolve(undefined);
  });
  await expectUnmountedPendingSettled(pending);
});

it("releases a pending rejection after final unmount without destroy", async () => {
  const pending = createUnmountedPendingHarness();

  await settle(() => {
    pending.first.creation.reject(new Error("Final failure."));
  });
  expect(pending.first.destroy).not.toHaveBeenCalled();
  await expectUnmountedPendingSettled(pending);
});

function createEditor(
  overrides: Partial<MilkdownEditorProps> = {},
): ReactElement {
  return (
    <MilkdownEditor
      initialDisposition="none"
      initialMarkdown="# Home"
      initialMode="wysiwyg"
      initialRevision={0}
      noteId="index.md"
      onEditorModeChange={() => {}}
      onPublishMarkdown={createAcknowledgingPublisher()}
      sessionGate={createTestEditorSessionGate()}
      sessionKey="index.md:1"
      title="Home"
      {...overrides}
    />
  );
}

function renderStrictEditor(overrides: Partial<MilkdownEditorProps> = {}) {
  return render(<StrictMode>{createEditor(overrides)}</StrictMode>);
}

type ControlledGeneration = {
  readonly creation: ReturnType<typeof createDeferred<undefined>>;
  readonly destroy: MockFunction;
  readonly input: Parameters<CrepeRuntimeFactory>[0];
  readonly teardown: ReturnType<typeof createDeferred<undefined>>;
};

function createControlledRuntimeHarness() {
  const generations: ControlledGeneration[] = [];
  const createRuntime: CrepeRuntimeFactory = (input) => {
    const creation = createDeferred<undefined>();
    const teardown = createDeferred<undefined>();
    const destroy = vi.fn(() => teardown.promise);
    generations.push({ creation, destroy, input, teardown });
    return {
      create: () => creation.promise,
      destroy,
      getMarkdown: () => input.initialMarkdown,
      replaceMarkdown: () => {},
    };
  };
  return { createRuntime, generations };
}

function createUnmountedPendingHarness() {
  const harness = createControlledRuntimeHarness();
  const publish = vi.fn(createAcknowledgingPublisher());
  const mounted = renderStrictEditor({
    createRuntime: harness.createRuntime,
    onPublishMarkdown: publish,
  });
  const first = harness.generations[0];
  if (first === undefined) {
    throw new Error("The diagnostic generation was not created.");
  }
  const firstRoot = first.input.root;
  mounted.unmount();
  return { first, firstRoot, harness, publish };
}

async function expectUnmountedPendingSettled(
  pending: ReturnType<typeof createUnmountedPendingHarness>,
): Promise<void> {
  await settle(() => {});
  expect(pending.harness.generations).toHaveLength(1);
  expect(pending.firstRoot.isConnected).toBe(false);
  expect(pending.publish).not.toHaveBeenCalled();
}

function createFailingRuntime(stage: "create" | "factory" | "reject"): {
  createRuntime: CrepeRuntimeFactory;
  destroy: MockFunction;
  roots: ReadonlySet<HTMLDivElement>;
} {
  const destroy = vi.fn(() => Promise.resolve());
  const roots = new Set<HTMLDivElement>();
  const createRuntime = vi.fn<CrepeRuntimeFactory>(({ root }) => {
    roots.add(root);
    if (stage === "factory") {
      throw new Error("Injected factory failure.");
    }
    return {
      create: () => {
        if (stage === "reject") {
          return Promise.reject(new Error("Injected create failure."));
        }
        throw new Error("Injected synchronous create failure.");
      },
      destroy,
      getMarkdown: () => "# Stale",
      replaceMarkdown: () => {},
    };
  });
  return { createRuntime, destroy, roots };
}

async function expectWysiwygReady(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeEnabled();
  });
}

async function settle(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

function createDeferred<Value>() {
  let resolvePromise: (value: Value) => void = () => {};
  let rejectPromise: (reason?: unknown) => void = () => {};
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}
