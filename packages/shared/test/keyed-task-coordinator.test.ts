import { describe, expect, it, vi } from "vitest";

import { KeyedTaskCoordinator } from "../src/keyed-task-coordinator.js";

describe("KeyedTaskCoordinator", () => {
  it("releases failed keys and removes them when idle", async () => {
    const coordinator = new KeyedTaskCoordinator();
    await expect(
      coordinator.run("note", () => Promise.reject(new Error("failed"))),
    ).rejects.toThrow("failed");
    await expect(
      coordinator.run("note", () => Promise.resolve("recovered")),
    ).resolves.toBe("recovered");
    expect(coordinator.activeKeyCount).toBe(0);
  });

  it("does not globally serialize different keys", async () => {
    const coordinator = new KeyedTaskCoordinator();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = coordinator.run("first", () => firstGate);
    const secondTask = vi.fn(() => Promise.resolve("second"));
    const second = coordinator.run("second", secondTask);

    await expect(second).resolves.toBe("second");
    expect(secondTask).toHaveBeenCalledTimes(1);
    releaseFirst();
    await first;
    expect(coordinator.activeKeyCount).toBe(0);
  });
});
