import { z } from "zod";

/** Current browser draft schema version stored in IndexedDB. */
export const draftSchemaVersion = 1;

/** Runtime schema for editor modes that affect recovered draft hydration. */
export const editorModeSchema = z.enum(["markdown", "wysiwyg"]);

/** Runtime schema for one durable browser draft record. */
export const draftRecordSchema = z.object({
  baseContentHash: z.string().min(1),
  clusterId: z.uuid(),
  editorMode: editorModeSchema,
  id: z.string().min(1),
  markdown: z.string(),
  noteId: z.string().min(1),
  schemaVersion: z.literal(draftSchemaVersion),
  updatedAt: z.iso.datetime(),
});

/** Durable browser draft record scoped to one cluster note. */
export type DraftRecord = z.infer<typeof draftRecordSchema>;

/** Editor mode stored with drafts so recovery returns to the same surface. */
export type EditorMode = z.infer<typeof editorModeSchema>;

/** Validation decision for a raw IndexedDB draft value. */
export type DraftRecordValidationResult =
  | { readonly record: DraftRecord; readonly status: "valid" }
  | { readonly status: "delete" }
  | { readonly status: "preserve" };

type DraftRecordInput = Omit<
  DraftRecord,
  "id" | "schemaVersion" | "updatedAt"
> & {
  readonly updatedAt?: string;
};

/** Creates the stable current-version draft key for one cluster note. */
export function createDraftRecordId(clusterId: string, noteId: string): string {
  return `draft:v${String(draftSchemaVersion)}:${clusterId}:${noteId}`;
}

/** Creates a validated current-version draft record for IndexedDB storage. */
export function createDraftRecord(input: DraftRecordInput): DraftRecord {
  return draftRecordSchema.parse({
    ...input,
    id: createDraftRecordId(input.clusterId, input.noteId),
    schemaVersion: draftSchemaVersion,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
}

/** Decides whether a stored draft can be used, deleted, or preserved. */
export function validateStoredDraftRecord(
  value: unknown,
): DraftRecordValidationResult {
  const schemaVersion = getSchemaVersion(value);

  if (schemaVersion === undefined) {
    return { status: "delete" };
  }

  if (schemaVersion > draftSchemaVersion) {
    return { status: "preserve" };
  }

  return validateCurrentDraftRecord(value);
}

function validateCurrentDraftRecord(
  value: unknown,
): DraftRecordValidationResult {
  const parsedRecord = draftRecordSchema.safeParse(value);

  return parsedRecord.success
    ? { record: parsedRecord.data, status: "valid" }
    : { status: "delete" };
}

function getSchemaVersion(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return typeof value.schemaVersion === "number"
    ? value.schemaVersion
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
