import { z } from "zod";

/** Exact HTTP header names used for Azurite diagnostic correlation. */
export const correlationHeaderNames = {
  noteOperationId: "x-azurite-note-operation-id",
  requestId: "x-azurite-request-id",
} as const;

/** Bounded reasons why browser correlation ID generation terminated. */
export const correlationFailureReasons = {
  cryptoUnavailable: "crypto_unavailable",
  randomValuesFailed: "random_values_failed",
  randomValuesUnavailable: "random_values_unavailable",
  uuidInvalid: "uuid_invalid",
} as const;

/** Browser-owned correlation identifier kinds. */
export const correlationIdKinds = {
  noteOperation: "note_operation",
  request: "request",
} as const;

/** Server dispositions for a client note-operation header. */
export const noteOperationIdStatuses = {
  accepted: "accepted",
  invalid: "invalid",
  missing: "missing",
} as const;

/** Sources for the trusted server request identifier. */
export const requestIdSources = {
  client: "client",
  serverInvalid: "server_invalid",
  serverMissing: "server_missing",
} as const;

/** Shared UUID-v4 validation used by every correlation identifier. */
export const correlationUuidV4Schema = z.uuidv4();

/** Branded schema for one HTTP request-attempt identifier. */
export const requestIdSchema = correlationUuidV4Schema.brand<"RequestId">();

/** Branded schema for one semantic note-operation identifier. */
export const noteOperationIdSchema =
  correlationUuidV4Schema.brand<"NoteOperationId">();

/** One validated HTTP request-attempt identifier. */
export type RequestId = z.infer<typeof requestIdSchema>;

/** One validated semantic note load or manual-save identifier. */
export type NoteOperationId = z.infer<typeof noteOperationIdSchema>;

/** Explicit optional identifiers passed into one browser API attempt. */
export type ApiRequestMetadata = {
  readonly noteOperationId?: NoteOperationId;
  readonly requestId?: RequestId;
};

/** Input shape accepted by defensive correlation-header parsers. */
export type CorrelationHeaderInput = string | readonly string[] | undefined;

/** Result of validating one optional correlation header. */
export type ParsedCorrelationHeader<Value> =
  | { readonly status: "invalid" | "missing" }
  | { readonly status: "accepted"; readonly value: Value };

/** Parses one request-ID header without retaining rejected input. */
export function parseRequestIdHeader(
  input: CorrelationHeaderInput,
): ParsedCorrelationHeader<RequestId> {
  return parseCorrelationHeader(input, requestIdSchema);
}

/** Parses one note-operation-ID header without retaining rejected input. */
export function parseNoteOperationIdHeader(
  input: CorrelationHeaderInput,
): ParsedCorrelationHeader<NoteOperationId> {
  return parseCorrelationHeader(input, noteOperationIdSchema);
}

function parseCorrelationHeader<Schema extends z.ZodType>(
  input: CorrelationHeaderInput,
  schema: Schema,
): ParsedCorrelationHeader<z.output<Schema>> {
  if (input === undefined) {
    return { status: "missing" };
  }

  if (typeof input !== "string") {
    return { status: "invalid" };
  }

  return toParsedCorrelationHeader(schema.safeParse(input));
}

function toParsedCorrelationHeader<Schema extends z.ZodType>(
  parsed: z.ZodSafeParseResult<z.output<Schema>>,
): ParsedCorrelationHeader<z.output<Schema>> {
  if (!parsed.success) {
    return { status: "invalid" };
  }
  return { status: "accepted", value: parsed.data };
}
