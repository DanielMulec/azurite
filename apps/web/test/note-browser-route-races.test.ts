import { describe, expect, it, vi } from "vitest";

import type { NoteBrowserApi } from "../src/state/note-browser-contracts.js";
import {
  createApi,
  createDeferred,
  createLoadedStore,
  createNote,
  readyClusterIdentity,
} from "./note-browser-store-test-helpers.js";
import { selectTestNote } from "./note-browser-route-test-helpers.js";

describe("classified A to B to A route race", () => {
  it.each(["a_first", "b_first"] as const)(
    "settles on A when $responseOrder responses complete",
    async (responseOrder) => {
      const bRead = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
      const aRead = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
      const readNote = vi
        .fn<NoteBrowserApi["readNote"]>()
        .mockImplementationOnce(() => bRead.promise)
        .mockImplementationOnce(() => aRead.promise);
      const store = createLoadedStore({ api: createApi({ readNote }) });

      const bSelection = selectTestNote(store, "Projects/azurite.md");
      await expectReadCount(readNote, 1);
      const aSelection = selectTestNote(store, "index.md");
      await expectReadCount(readNote, 2);
      resolveInOrder(responseOrder, { aRead, bRead });
      await Promise.all([aSelection, bSelection]);

      expect(readNote.mock.calls.map(([noteId]) => noteId)).toEqual([
        "Projects/azurite.md",
        "index.md",
      ]);
      expect(store.getState()).toMatchObject({
        committedRouteView: { noteId: "index.md", view: "ready" },
        noteState: { editor: { note: { id: "index.md" } }, status: "ready" },
        selectedNoteId: "index.md",
      });
    },
  );
});

describe("same-note authorization after an intervening intent", () => {
  it("starts a fresh B read instead of reusing the stale B promise", async () => {
    const firstB = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const interveningA =
      createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const currentB = createDeferred<ReturnType<NoteBrowserApi["readNote"]>>();
    const readNote = vi
      .fn<NoteBrowserApi["readNote"]>()
      .mockImplementationOnce(() => firstB.promise)
      .mockImplementationOnce(() => interveningA.promise)
      .mockImplementationOnce(() => currentB.promise);
    const store = createLoadedStore({ api: createApi({ readNote }) });

    const staleB = selectTestNote(store, "Projects/azurite.md");
    await expectReadCount(readNote, 1);
    const staleA = selectTestNote(store, "index.md");
    await expectReadCount(readNote, 2);
    const latestB = selectTestNote(store, "Projects/azurite.md");
    await expectReadCount(readNote, 3);
    currentB.resolve(projectResponse("# Latest B", "sha256-current-b"));
    await latestB;
    firstB.resolve(projectResponse("# Stale B", "sha256-stale-b"));
    interveningA.resolve(homeResponse());
    await Promise.all([staleA, staleB]);

    expect(store.getState()).toMatchObject({
      committedRouteView: { noteId: "Projects/azurite.md", view: "ready" },
      noteState: {
        editor: {
          currentMarkdown: "# Latest B",
          note: { id: "Projects/azurite.md" },
        },
        status: "ready",
      },
      selectedNoteId: "Projects/azurite.md",
    });
  });
});

async function expectReadCount(
  readNote: ReturnType<typeof vi.fn<NoteBrowserApi["readNote"]>>,
  count: number,
): Promise<void> {
  await vi.waitFor(() => {
    expect(readNote).toHaveBeenCalledTimes(count);
  });
}

function resolveInOrder(
  responseOrder: "a_first" | "b_first",
  reads: {
    readonly aRead: ReturnType<
      typeof createDeferred<ReturnType<NoteBrowserApi["readNote"]>>
    >;
    readonly bRead: ReturnType<
      typeof createDeferred<ReturnType<NoteBrowserApi["readNote"]>>
    >;
  },
): void {
  if (responseOrder === "a_first") {
    reads.aRead.resolve(homeResponse());
    reads.bRead.resolve(projectResponse("# Stale B", "sha256-stale-b"));
    return;
  }
  reads.bRead.resolve(projectResponse("# Stale B", "sha256-stale-b"));
  reads.aRead.resolve(homeResponse());
}

function homeResponse() {
  return {
    clusterIdentity: readyClusterIdentity,
    note: createNote("index.md", "# Current A", "sha256-current-a"),
  };
}

function projectResponse(markdown: string, contentHash: string) {
  return {
    clusterIdentity: readyClusterIdentity,
    note: createNote("Projects/azurite.md", markdown, contentHash),
  };
}
