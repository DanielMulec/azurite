import { z } from "zod";

export const applicationName = "Azurite";

export const healthCheckResponseSchema = z.object({
  service: z.literal("azurite"),
  status: z.literal("ok"),
  version: z.string().min(1),
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;

export function createHealthCheckResponse(
  version: string,
): HealthCheckResponse {
  return healthCheckResponseSchema.parse({
    service: "azurite",
    status: "ok",
    version,
  });
}
