import { z } from "zod";

/** Stable reasons why Azurite cannot currently identify a cluster. */
export const clusterIdentityUnavailableReasonSchema = z.enum([
  "metadata_invalid",
  "metadata_unavailable",
  "metadata_unwritable",
]);

/** Runtime contract for the current workspace cluster identity state. */
export const clusterIdentitySchema = z.discriminatedUnion("status", [
  z.object({
    clusterId: z.uuid(),
    status: z.literal("ready"),
  }),
  z.object({
    reason: clusterIdentityUnavailableReasonSchema,
    status: z.literal("unavailable"),
  }),
]);

/** TypeScript view of the current workspace cluster identity state. */
export type ClusterIdentity = z.infer<typeof clusterIdentitySchema>;

/** TypeScript view of cluster identity unavailable reason codes. */
export type ClusterIdentityUnavailableReason = z.infer<
  typeof clusterIdentityUnavailableReasonSchema
>;
