// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactElement } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  MilkdownEditor,
  type MilkdownEditorProps,
} from "../src/components/MilkdownEditor.js";
import type { CrepeRuntimeFactory } from "../src/components/crepe-runtime.js";
import {
  createAcknowledgingPublisher,
  createTestEditorSessionGate,
} from "./editor-session-gate-test-helpers.js";

type MockFunction = ReturnType<typeof vi.fn>;

afterEach(cleanup);

it("characterizes balanced Crepe calls around current StrictMode replay", async () => {
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

it.fails(
  "retains one ready isolated generation and releases every remount",
  async () => {
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
  },
);

it.fails.each(["success", "failure"] as const)(
  "orders teardown and rejects stale %s work after a successor is ready",
  async (outcome) => {
    const harness = createControlledRuntimeHarness();
    const publish = vi.fn(createAcknowledgingPublisher());
    const mounted = renderStrictEditor({
      createRuntime: harness.createRuntime,
      onPublishMarkdown: publish,
    });

    expect(harness.generations).toHaveLength(1);
    expect(harness.generations[0]?.destroy).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();
    await settle(() => harness.generations[0]?.teardown.resolve(undefined));
    await waitFor(() => {
      expect(harness.generations).toHaveLength(2);
    });
    await settle(() => harness.generations[1]?.creation.resolve(undefined));
    await expectWysiwygReady();

    harness.generations[0]?.input.onMarkdownUpdated("# Retired callback");
    await settle(() => {
      if (outcome === "success") {
        harness.generations[0]?.creation.resolve(undefined);
      } else {
        harness.generations[0]?.creation.reject(new Error("Stale failure."));
      }
    });
    expect(publish).not.toHaveBeenCalled();
    expect(screen.queryByText(/could not be created/u)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeEnabled();

    mounted.unmount();
    expect(harness.generations[1]?.destroy).toHaveBeenCalledOnce();
    harness.generations[1]?.teardown.resolve(undefined);
  },
);

it.fails.each(["factory", "create", "reject"] as const)(
  "keeps exact source after a %s creation failure",
  async (stage) => {
    const publish = vi.fn(createAcknowledgingPublisher());
    renderStrictEditor({
      createRuntime: createFailingRuntime(stage),
      initialMarkdown: "# Exact survives",
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
  },
);

it.fails(
  "makes teardown rejection visible and keeps exact source usable",
  async () => {
    const createRuntime = vi.fn<CrepeRuntimeFactory>(() => ({
      create: () => Promise.resolve(),
      destroy: () => Promise.reject(new Error("Injected teardown failure.")),
      getMarkdown: () => "# Exact survives",
      replaceMarkdown: () => {},
    }));
    renderStrictEditor({
      createRuntime,
      initialMarkdown: "# Exact survives",
    });

    expect(
      await screen.findByText(/could not be (destroyed|released)/u),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown source for Home")).toHaveValue(
      "# Exact survives",
    );
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeDisabled();
    expect(createRuntime).toHaveBeenCalledOnce();
  },
);

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

function createFailingRuntime(
  stage: "create" | "factory" | "reject",
): CrepeRuntimeFactory {
  return () => {
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
      destroy: () => Promise.resolve(),
      getMarkdown: () => "# Stale",
      replaceMarkdown: () => {},
    };
  };
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
