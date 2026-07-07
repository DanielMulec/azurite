import { applicationName } from "@azurite/shared";

/** Returns the product title from the shared package so UI copy has one source. */
export function getApplicationTitle(): string {
  return applicationName;
}
