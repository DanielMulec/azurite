// @vitest-environment jsdom

import { Editor, EditorStatus } from "@milkdown/kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});

describe("installed Milkdown lifecycle contract", () => {
  it("retains OnCreate and an unsettled destroy loop after creation rejects", async () => {
    vi.useFakeTimers();
    const editor = Editor.make().config(() => {
      throw new Error("Injected Milkdown creation failure.");
    });

    await expect(editor.create()).rejects.toThrow(
      "Injected Milkdown creation failure.",
    );
    expect(editor.status).toBe(EditorStatus.OnCreate);

    const timersAfterCreate = vi.getTimerCount();
    let destroySettled = false;
    void editor.destroy().then(() => {
      destroySettled = true;
    });
    expect(vi.getTimerCount()).toBe(timersAfterCreate + 1);
    await vi.advanceTimersByTimeAsync(150);

    expect(destroySettled).toBe(false);
    expect(editor.status).toBe(EditorStatus.OnCreate);
    expect(vi.getTimerCount()).toBeGreaterThan(timersAfterCreate);
  });
});
