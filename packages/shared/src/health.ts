import { z } from "zod";

/** Human-readable product name shared across app surfaces and tests. */
export const applicationName = "Azurite";

/** Runtime contract for the server health endpoint response. */
export const healthCheckResponseSchema = z.object({
  service: z.literal("azurite"),
  status: z.literal("ok"),
  version: z.string().min(1),
});

/** TypeScript view of a validated health endpoint response. */
export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;

/** Builds a health response through the schema so runtime and static types stay aligned. */
export function createHealthCheckResponse(
  version: string,
): HealthCheckResponse {
  return healthCheckResponseSchema.parse({
    service: "azurite",
    status: "ok",
    version,
  });
}
