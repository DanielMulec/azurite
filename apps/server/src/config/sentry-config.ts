/** Parsed backend observability configuration. */
export type ServerSentryConfig = {
  readonly dsn: string | undefined;
  readonly enabled: boolean;
  readonly environment: string;
  readonly release: string;
  readonly testEventsEnabled: boolean;
  readonly traceSampleRate: number;
};

const defaultEnvironment = "development";
const defaultRelease = "azurite-local";
const defaultTraceSampleRate = 1;

/** Reads process environment values through the typed server config boundary. */
export function readServerSentryConfig(): ServerSentryConfig {
  return parseServerSentryConfig(process.env);
}

/** Parses backend observability configuration without depending on its value source. */
export function parseServerSentryConfig(
  environment: NodeJS.ProcessEnv,
): ServerSentryConfig {
  const dsn = parseOptionalString(environment.SENTRY_DSN);

  return {
    dsn,
    enabled: environment.SENTRY_ENABLED === "true" && dsn !== undefined,
    environment: parseStringWithFallback(
      environment.SENTRY_ENVIRONMENT,
      defaultEnvironment,
    ),
    release: parseStringWithFallback(
      environment.SENTRY_RELEASE,
      defaultRelease,
    ),
    testEventsEnabled:
      environment.NODE_ENV !== "production" &&
      environment.SENTRY_TEST_EVENTS_ENABLED === "true",
    traceSampleRate: parseSampleRate(
      environment.SENTRY_TRACE_SAMPLE_RATE,
      defaultTraceSampleRate,
    ),
  };
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

function parseSampleRate(value: string | undefined, fallback: number): number {
  const parsedValue = parseOptionalString(value);

  if (parsedValue === undefined) {
    return fallback;
  }

  return normalizeSampleRate(Number(parsedValue)) ?? fallback;
}

function normalizeSampleRate(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const clampedValue = Math.min(1, Math.max(0, value));
  return Object.is(clampedValue, value) ? value : undefined;
}

function parseStringWithFallback(
  value: string | undefined,
  fallback: string,
): string {
  return parseOptionalString(value) ?? fallback;
}
