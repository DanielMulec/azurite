import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiErrorCodes,
  type ListNotesResponse,
  type ReadNoteResponse,
} from "@azurite/shared";
import { listNotes, readNote, WebApiError } from "../src/api-client.js";

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
  markdown: "# Home\n",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listNotes", () => {
  it("loads and validates note list responses", async () => {
    const responseBody = {
      notes: [validNoteSummary],
    } satisfies ListNotesResponse;
    const fetchMock = stubJsonResponse(responseBody, 200);

    await expect(listNotes()).resolves.toEqual(responseBody);
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

    await expect(listNotes()).rejects.toMatchObject({
      code: apiErrorCodes.workspaceNotConfigured,
      message: "Workspace path is not configured.",
      statusCode: 500,
    });
  });

  it("rejects invalid success payloads", async () => {
    stubJsonResponse({ notes: [{ id: "" }] }, 200);
    const request = listNotes();

    await expect(request).rejects.toBeInstanceOf(WebApiError);
    await expect(request).rejects.toMatchObject({
      message: "Azurite returned an unexpected response shape.",
    });
  });
});

describe("readNote", () => {
  it("loads one note through an encoded shared route", async () => {
    const responseBody = { note: validNoteContent } satisfies ReadNoteResponse;
    const fetchMock = stubJsonResponse(responseBody, 200);

    await expect(readNote("Projects/azurite.md")).resolves.toEqual(
      responseBody,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes/content?noteId=Projects%2Fazurite.md",
      {
        headers: { Accept: "application/json" },
      },
    );
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
