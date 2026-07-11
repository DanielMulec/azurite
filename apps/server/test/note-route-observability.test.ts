import { describe, expect, it } from "vitest";

import { createClusterAttributes } from "../src/note-route-observability.js";

describe("note route cluster evidence", () => {
  it("reports only truthful ready and unavailable identity attributes", () => {
    expect(
      createClusterAttributes({
        clusterId: "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793",
        status: "ready",
      }),
    ).toEqual({
      "azurite.cluster_id": "1bdbab0a-79c5-4c6d-a6b5-30bf65a49793",
      "azurite.cluster_identity_status": "ready",
    });
    expect(
      createClusterAttributes({
        reason: "metadata_unwritable",
        status: "unavailable",
      }),
    ).toEqual({
      "azurite.cluster_identity_reason": "metadata_unwritable",
      "azurite.cluster_identity_status": "unavailable",
    });
  });
});
