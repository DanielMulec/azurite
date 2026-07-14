// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

describe("the component-test StrictMode default", () => {
  it("replays setup and balances cleanup without a per-test wrapper", () => {
    const setup = vi.fn();
    const cleanup = vi.fn();

    function LifecycleProbe(): null {
      useEffect(() => {
        setup();
        return cleanup;
      }, []);
      return null;
    }

    const view = render(<LifecycleProbe />);

    expect(setup).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledOnce();

    view.unmount();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
