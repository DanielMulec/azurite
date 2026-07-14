import type {
  PublicationCommand,
  PublicationResult,
} from "../src/domain/markdown-authority-types.js";
import type {
  EditorControllerCapability,
  EditorSessionGate,
} from "../src/components/editor-session-gate.js";

/** Creates a detached React gate for isolated component tests. */
export function createTestEditorSessionGate(): EditorSessionGate {
  let controller: EditorControllerCapability | undefined;
  return {
    commitCurrent: (cause) => controller?.commit(cause),
    commitLifecycle: () => Promise.resolve(),
    getSnapshot: () => ({
      frozenSessionKey: undefined,
      message: undefined,
    }),
    isSessionFrozen: () => false,
    registerController: (nextController) => {
      controller = nextController;
      return () => {
        if (controller === nextController) {
          controller = undefined;
        }
      };
    },
    routeGate: {
      prepare: () => ({ status: "continue" }),
      settle: () => {},
    },
    runTerminalAction: async (_sessionKey, action) => {
      await action();
    },
    subscribe: () => () => {},
  };
}

/** Creates a publisher that acknowledges exact component-test changes. */
export function createAcknowledgingPublisher(): (
  _command: PublicationCommand,
) => PublicationResult {
  return () => ({ status: "accepted" });
}
