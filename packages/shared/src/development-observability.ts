import { z } from "zod";

/** Response returned after an explicit, non-mutating server test event. */
export const sentryTestEventResponseSchema = z.object({
  marker: z.string(),
  status: z.literal("sent"),
  traceHeaders: z.object({
    baggage: z.boolean(),
    sentryTrace: z.boolean(),
  }),
});

/** Parsed response from the development-only Sentry test route. */
export type SentryTestEventResponse = z.infer<
  typeof sentryTestEventResponseSchema
>;
