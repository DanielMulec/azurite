import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiErrorCodes,
  correlationHeaderNames,
  noteOperationIdSchema,
  requestIdSchema,
  type ListNotesResponse,
  type ReadNoteResponse,
  type SaveNoteResponse,
} from "@azurite/shared";
import {
  listNotes,
  readNote,
  saveNote,
  WebApiError,
} from "../src/api-client.js";

const validClusterIdentity = {
  clusterId: "019f42b1-558c-7114-8b2d-5d34cb7a4ef7",
  status: "ready",
} as const;
const validNoteSummary = {
  fileName: "index.md",
  id: "index.md",
  lastModifiedAt: "2026-07-07T12:00:00.000Z",
  relativePath: "index.md",
  sizeBytes: 42,
  title: "Home",
};
const validNoteContent = {
  ...validNoteSummary,
  contentHash: "sha256-home",
  markdown: "# Home\n",
};
const requestMetadata = {
  noteOperationId: noteOperationIdSchema.parse(
    "30be2dc8-5ff8-46df-838a-d56170c0b752",
  ),
  requestId: requestIdSchema.parse("4f1e6420-59bf-4ec0-b51e-64308be18fee"),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listNotes", () => {
  it("loads and validates note list responses", async () => {
    const responseBody = {
      clusterIdentity: validClusterIdentity,
      notes: [validNoteSummary],
    } satisfies ListNotesResponse;
    const fetchMock = stubJsonResponse(responseBody, 200);

    await expect(listNotes({})).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes", {
      headers: { Accept: "application/json" },
    });
  });

  it("converts API error responses into safe web errors", async () => {
    stubJsonResponse(
      {
        error: {
          code: apiErrorCodes.workspaceNotConfigured,
          message: "Workspace path is not configured.",
        },
      },
      500,
    );

    await expect(listNotes({})).rejects.toMatchObject({
      code: apiErrorCodes.workspaceNotConfigured,
      message: "Workspace path is not configured.",
      statusCode: 500,
    });
  });

  it("rejects invalid success payloads", async () => {
    stubJsonResponse({ notes: [{ id: "" }] }, 200);
    const request = listNotes({});

    await expect(request).rejects.toBeInstanceOf(WebApiError);
    await expect(request).rejects.toMatchObject({
      message: "Azurite returned an unexpected response shape.",
    });
  });
});

describe("readNote", () => {
  it("loads one note through an encoded shared route", async () => {
    const responseBody = {
      clusterIdentity: validClusterIdentity,
      note: validNoteContent,
    } satisfies ReadNoteResponse;
    const fetchMock = stubJsonResponse(responseBody, 200);

    await expect(
      readNote("Projects/azurite.md", requestMetadata),
    ).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes/content?noteId=Projects%2Fazurite.md",
      {
        headers: {
          Accept: "application/json",
          [correlationHeaderNames.noteOperationId]:
            requestMetadata.noteOperationId,
          [correlationHeaderNames.requestId]: requestMetadata.requestId,
        },
      },
    );
  });
});

describe("saveNote", () => {
  it("saves one note with the expected JSON request", async () => {
    const responseBody = {
      clusterIdentity: validClusterIdentity,
      note: validNoteContent,
    } satisfies SaveNoteResponse;
    const fetchMock = stubJsonResponse(responseBody, 200);

    await expect(
      saveNote(
        {
          expectedContentHash: "sha256-before",
          markdown: "# Home\n",
          noteId: "index.md",
        },
        requestMetadata,
      ),
    ).resolves.toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes/content", {
      body: JSON.stringify({
        expectedContentHash: "sha256-before",
        markdown: "# Home\n",
        noteId: "index.md",
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [correlationHeaderNames.noteOperationId]:
          requestMetadata.noteOperationId,
        [correlationHeaderNames.requestId]: requestMetadata.requestId,
      },
      method: "PUT",
    });
  });

  it("preserves typed conflict errors", async () => {
    stubJsonResponse(
      {
        error: {
          code: apiErrorCodes.noteWriteConflict,
          message: "The note changed on disk before Azurite could save it.",
        },
      },
      409,
    );

    await expect(
      saveNote(
        {
          expectedContentHash: "sha256-before",
          markdown: "# Home\n",
          noteId: "index.md",
        },
        {},
      ),
    ).rejects.toMatchObject({
      code: apiErrorCodes.noteWriteConflict,
      statusCode: 409,
    });
  });
});

function stubJsonResponse(body: unknown, status: number) {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}
